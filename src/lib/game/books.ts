import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAll } from "@/lib/supabase/read-all";
import { whoWasHere } from "@/lib/game/roster";
import { compareResults } from "@/lib/game/ranking";
import { playerCache } from "@/lib/game/cache";

/*
  What everybody turned out to be holding, once a contest is over.

  Here rather than in battles.ts because it is not only a battle's. The house
  week is the game everybody actually plays -- a battle is optional and needs
  a league that has decided to start one -- so a reveal that existed for the
  second and not the first was the wrong way round.

  Both are the same shape and the same rule: only after it is settled. Live,
  this is a copying machine, and a league would converge on one book by
  Wednesday.
*/

/**
 * What one player was holding when a contest ended.
 *
 * Only ever for a contest that has ended, which is the whole of why this can
 * exist at all. Live, it would be a copying machine: the person in front is
 * visible to everybody behind them, and a league would converge on one book
 * by Wednesday. Settled, it is the opposite -- it is the conversation the
 * game is actually for. "How were you up nine per cent" is the first thing
 * anybody asks, and until now Arena could not answer it.
 *
 * Facts only. Symbols, share counts and what they cost, which are what they
 * were and cannot change. No current value and no gain: settling does not
 * clear holdings and the rooms price them live, so a "worth" here would
 * drift every day after a contest nobody can trade in any more.
 */
export type RevealedBook = {
  userId: string;
  displayName: string;
  rank: number;
  returnPercent: number;
  /** What they never put to work. A story in itself, when it is most of it. */
  cash: number;

  /**
   * Whether they ever traded in this contest at all.
   *
   * Somebody holding nothing at the end is two completely different people:
   * one who sold up before the close, and one who never turned up. Without
   * this the panel called both of them a decision to stay in cash, which is
   * putting a strategy in the mouth of somebody who simply missed it.
   */
  traded: boolean;
  positions: { symbol: string; quantity: number; costBasis: number }[];
};


/** A settled week, and what everybody in one league was holding at the end of it. */
export type WeekBooks = {
  monday: string;
  books: RevealedBook[];
};

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

/**
 * The last settled house week, opened up for one league.
 *
 * The week is the game everybody plays. A battle needs a league to have
 * decided to start one; the week happens to all of them, every Monday, so
 * this is the reveal that will actually be read.
 *
 * Only people who were scored. Somebody with no portfolio that week was not
 * in that week's table and putting them in this one would invent a player.
 * That is the one way it differs from a battle's reveal, where the league
 * roster is the field by construction.
 *
 * Every past week is recoverable, because a week gets its own portfolio and
 * nothing deletes the old ones. Only the most recent is shown, because a
 * league arguing about a week two months ago is not a thing that happens and
 * a page of every week that ever was is a page nobody reads.
 */
export async function getLastWeekBooks(
  userId: string,
  leagueId: string
): Promise<WeekBooks | null> {
  "use cache";
  playerCache(userId);

  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const [{ data: members }, { data: cycles }] = await Promise.all([
    admin
      .from("league_members")
      .select("user_id, joined_at")
      .eq("league_id", leagueId),
    admin
      .from("weekly_cycles")
      .select("id, monday, ends_on")
      .is("league_id", null)
      .eq("status", "closed")
      .order("monday", { ascending: false })
      .limit(1),
  ]);

  const roster = (members ?? []) as { user_id: string; joined_at: string }[];
  const memberIds = roster.map((row) => row.user_id);

  // Membership is established from the roster rather than assumed from the
  // URL, the same as everywhere else: a league id is not a secret.
  if (!memberIds.includes(userId)) return null;

  const cycle = ((cycles ?? []) as { id: string; monday: string; ends_on: string }[])[0];
  if (!cycle) return null;

  /*
    Who was in this league while that week was running.

    A portfolio belongs to a person and a cycle, not to a league, so somebody
    who played last week on their own and joined here on Monday has a book
    from it -- and without this they would be in a reveal for a week they were
    not in this league for, with their holdings shown to people who were not
    playing against them and their return shifting everybody else's rank.

    The same test getLeagueRecord uses for the same reason, so the two panels
    in this room cannot disagree about who was in a week. Comparing dates
    alone is wrong by an evening in one direction and reading the timestamp's
    first ten characters, which is UTC, is wrong by an evening in the other.
  */
  const wasHere = whoWasHere(
    roster.map((row) => ({ userId: row.user_id, joinedAt: row.joined_at })),
    cycle.ends_on
  );

  const { data: portfolioRows } = await admin
    .from("portfolios")
    .select("id, user_id, cash, return_percent")
    .eq("cycle_id", cycle.id)
    .in("user_id", [...wasHere])
    .not("return_percent", "is", null);

  const portfolios = (portfolioRows ?? []) as {
    id: string;
    user_id: string;
    cash: string;
    return_percent: string;
  }[];

  if (portfolios.length === 0) return null;

  const portfolioIds = portfolios.map((row) => row.id);

  const [holdingRows, { data: tradeRows }, { data: profileRows }] =
    await Promise.all([
      // A page at a time: a settled week's reveal shows every position every
      // member held, and nothing caps how many that is.
      readAll<{
        portfolio_id: string;
        symbol: string;
        quantity: string;
        cost_basis: string;
      }>(() =>
        admin
          .from("holdings")
          .select("portfolio_id, symbol, quantity, cost_basis")
          .in("portfolio_id", portfolioIds)
      ),
      // Counted in the database. A week's worth of one member's trades is up
      // to MAX_TRADES_PER_CYCLE rows, and all this needs is whether the
      // number is zero. See migration 0030.
      admin.rpc("portfolio_trade_counts", { p_portfolio_ids: portfolioIds }),
      admin.from("profiles").select("id, display_name").in("id", memberIds),
    ]);

  const byPortfolio = new Map<
    string,
    { symbol: string; quantity: number; costBasis: number }[]
  >();
  for (const row of holdingRows) {
    const list = byPortfolio.get(row.portfolio_id) ?? [];
    list.push({
      symbol: row.symbol,
      quantity: num(row.quantity),
      costBasis: num(row.cost_basis),
    });
    byPortfolio.set(row.portfolio_id, list);
  }

  const traded = new Set(
    ((tradeRows ?? []) as { portfolio_id: string; trades: number }[])
      .filter((row) => row.trades > 0)
      .map((row) => row.portfolio_id)
  );

  const nameById = new Map(
    ((profileRows ?? []) as { id: string; display_name: string | null }[]).map((row) => [
      row.id,
      row.display_name ?? "Player",
    ])
  );

  const books = portfolios
    .map((portfolio) => ({
      userId: portfolio.user_id,
      displayName: nameById.get(portfolio.user_id) ?? "Player",
      returnPercent: num(portfolio.return_percent),
      cash: num(portfolio.cash),
      traded: traded.has(portfolio.id),
      positions: (byPortfolio.get(portfolio.id) ?? []).sort(
        (a, b) => b.costBasis - a.costBasis
      ),
    }))
    .sort(compareResults)
    .map((book, index) => ({ ...book, rank: index + 1 }));

  return { monday: cycle.monday, books };
}
