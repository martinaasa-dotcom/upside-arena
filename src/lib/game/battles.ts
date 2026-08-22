import "server-only";

import { cache } from "react";
import { after } from "next/server";

import {
  MAX_TRADES_PER_CYCLE,
  MAX_TRADES_PER_MINUTE,
  STARTING_BALANCE,
} from "@/lib/game";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuotes, normaliseSymbol, type Quote } from "@/lib/market/quotes";
import { getSessionOpen } from "@/lib/market/benchmark";
import { isTradingOpen, nyDate } from "@/lib/market/session";
import {
  DEFAULT_FORMAT,
  checkTrade,
  formatById,
  positionValue,
  type Format,
  type FormatId,
} from "@/lib/game/formats";
import {
  lengthById,
  runEndsOn,
  runStartsOn,
  timeLeft,
  type LengthId,
  type RunLength,
} from "@/lib/game/lengths";
import type { LeagueRow, WeeklyCycleRow } from "@/lib/supabase/database.types";

/*
  Battles: a league's own contest, beside the house week.

  A battle is a weekly_cycle with a league on it. That is the whole trick and
  it is worth stating plainly here as well as in the migration, because it is
  what makes this file short: portfolios, holdings, the trade log, the claim,
  the settlement and every row level security policy already key on a cycle,
  so a battle inherits all of them and this file only has to know about the
  rules and the room.

  What it does not inherit, deliberately: a battle never touches a career.
  weeks_played, best_week_return, the season table and the pods are the house
  week and nothing else. Somebody who won a short-only fortnight beat four
  friends, which is the entire prize, and a season anybody could enter by
  choosing a format that suited them would not be a season.
*/

export type Battle = {
  cycleId: string;
  leagueId: string;
  leagueName: string;
  leagueIcon: string | null;
  format: Format;
  length: RunLength;
  startsOn: string;
  endsOn: string;
  status: WeeklyCycleRow["status"];
  finished: boolean;
  startingBalance: number;
  benchmarkSymbol: string;
  benchmarkOpen: number | null;
  benchmarkClose: number | null;
  /** True for the person who started it, who is the one who may call it off. */
  isYours: boolean;
  /** How long is left, in the words it would be said in. */
  timeLeft: string;
  /** True before the first day, which happens when one is started at the weekend. */
  notStarted: boolean;
};

export type BattlePosition = {
  symbol: string;
  quantity: number;
  costBasis: number;
  averageCost: number;
  quote: Quote | null;
  value: number;
  gain: number;
  gainPercent: number;
};

export type BattleStanding = {
  userId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  rank: number;
  totalValue: number;
  returnPercent: number;
  versusMarket: number | null;
  isYou: boolean;
  hasTraded: boolean;
};

/** How a settled battle ended, for whoever is being told about it. */
export type BattleResult = {
  cycleId: string;
  leagueId: string;
  leagueName: string;
  formatName: string;
  players: number;
  winner: { userId: string; displayName: string; returnPercent: number } | null;
  /** Every member who was scored, best first. */
  finished: { userId: string; displayName: string; returnPercent: number }[];
};

export type BattleView = {
  battle: Battle;
  standings: BattleStanding[];
  you: BattleStanding | null;
  benchmarkReturnPercent: number | null;
  /** The viewer's own book in this battle, priced now. */
  positions: BattlePosition[];
  cash: number;
  tradingOpen: boolean;
  /** Why it is not, when it is not. Empty when it is. */
  closedReason: string;
  marketState: string | null;
  anyStale: boolean;
};

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function toBattle(
  row: WeeklyCycleRow,
  league: Pick<LeagueRow, "id" | "name" | "icon">,
  viewerId: string,
  today = nyDate()
): Battle {
  return {
    cycleId: row.id,
    leagueId: league.id,
    leagueName: league.name,
    leagueIcon: league.icon,
    format: formatById(row.format),
    length: lengthById(row.length),
    startsOn: row.monday,
    endsOn: row.ends_on,
    status: row.status,
    finished: row.status === "closed",
    startingBalance: num(row.starting_balance),
    benchmarkSymbol: row.benchmark_symbol,
    benchmarkOpen: row.benchmark_open == null ? null : num(row.benchmark_open),
    benchmarkClose: row.benchmark_close == null ? null : num(row.benchmark_close),
    isYours: row.created_by === viewerId,
    timeLeft: row.status === "closed" ? "Finished" : timeLeft(row.ends_on, today),
    notStarted: today < row.monday,
  };
}

/**
 * The battle to show a league: the one running, or the last one that finished.
 *
 * One or the other rather than a list, because a league running four contests
 * at once is four scoreboards and no conversation. The database enforces the
 * same thing, so this is the reading half of one rule.
 */
export async function getLeagueBattle(
  userId: string,
  leagueId: string
): Promise<Battle | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const [{ data: leagueRow }, member] = await Promise.all([
    admin.from("leagues").select("id, name, icon").eq("id", leagueId).maybeSingle(),
    admin.rpc("is_league_member", { p_league_id: leagueId, p_user_id: userId }),
  ]);

  if (!leagueRow || member.data !== true) return null;

  /*
    The live one wins over the finished one, whatever the dates say. Ordering
    on the end date alone would show a league that had just started a year long
    battle the week they lost last month, because that week ended sooner.
  */
  const { data: rows } = await admin
    .from("weekly_cycles")
    .select("*")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false })
    .limit(4);

  const cycles = (rows ?? []) as WeeklyCycleRow[];
  const row = cycles.find((c) => c.status !== "closed") ?? cycles[0];
  if (!row) return null;

  return toBattle(row, leagueRow as LeagueRow, userId);
}

/** Every battle running in any of the viewer's leagues. For the home screen. */
export async function getLiveBattles(userId: string): Promise<Battle[]> {
  if (!canWriteGame) return [];

  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);

  const leagueIds = (memberships ?? []).map((m) => m.league_id as string);
  if (leagueIds.length === 0) return [];

  const [{ data: rows }, { data: leagues }] = await Promise.all([
    admin
      .from("weekly_cycles")
      .select("*")
      .in("league_id", leagueIds)
      .neq("status", "closed"),
    admin.from("leagues").select("id, name, icon").in("id", leagueIds),
  ]);

  const leagueById = new Map(
    ((leagues ?? []) as LeagueRow[]).map((league) => [league.id, league])
  );

  const today = nyDate();

  return ((rows ?? []) as WeeklyCycleRow[]).flatMap((row) => {
    const league = row.league_id ? leagueById.get(row.league_id) : null;
    if (!league) return [];
    return [toBattle(row, league, userId, today)];
  });
}

/**
 * Whether any league they are in has ever run one.
 *
 * For the first-week list, which asks "have they seen this part of the game
 * at all", not "is one running now". A battle that finished still counts:
 * somebody who has played one does not need to be told it exists.
 */
export async function hasEverPlayedBattle(userId: string): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);

  const leagueIds = (memberships ?? []).map((m) => m.league_id as string);
  if (leagueIds.length === 0) return false;

  const { data } = await admin
    .from("weekly_cycles")
    .select("id")
    .in("league_id", leagueIds)
    .limit(1);

  return (data ?? []).length > 0;
}

export type BattleOutcome =
  | { ok: true; battle: Battle }
  | { ok: false; error: string };

/**
 * Starting one.
 *
 * Any member may, not only the owner. A league where one person picks the game
 * and four people are told what they are playing is a league where one person
 * is playing.
 */
export async function startBattle(
  userId: string,
  leagueId: string,
  formatId: FormatId,
  lengthId: LengthId
): Promise<BattleOutcome> {
  if (!canWriteGame) return { ok: false, error: "Battles are not switched on yet." };

  const format = formatById(formatId);
  const length = lengthById(lengthId);

  const today = nyDate();

  /*
    A format whose market never shuts starts the day it is started, weekend
    included. Everything else waits for Monday, because a contest that opened
    on a Saturday would spend its first two days shut.
  */
  const alwaysOpen = format.tradingHours === "always";
  const startsOn = runStartsOn(today, alwaysOpen);
  const endsOn = runEndsOn(today, length.id, alwaysOpen);

  /*
    What it is measured against, asked for now. Usually known; null when the
    battle is started at the weekend or before the bell, because the opening
    price does not exist yet. That is allowed: the first view of the battle
    once the market has opened fills it in, and nothing can be settled without
    it.
  */
  const benchmarkOpen = await getSessionOpen(format.benchmark, startsOn);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_battle", {
    p_user_id: userId,
    p_league_id: leagueId,
    p_format: format.id,
    p_direction: format.direction,
    p_length: length.id,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_starting_balance: STARTING_BALANCE,
    p_benchmark_symbol: format.benchmark,
    p_benchmark_open: benchmarkOpen,
  });

  if (error) {
    if (error.message.includes("already has a battle")) {
      return {
        ok: false,
        error: "This league already has a battle running. Finish that one first.",
      };
    }
    if (error.message.includes("not a member")) {
      return { ok: false, error: "You are not in that league." };
    }
    return { ok: false, error: "We could not start that battle. Try again." };
  }

  const { data: leagueRow } = await admin
    .from("leagues")
    .select("id, name, icon")
    .eq("id", leagueId)
    .maybeSingle();

  return {
    ok: true,
    battle: toBattle(
      data as unknown as WeeklyCycleRow,
      (leagueRow ?? { id: leagueId, name: "League", icon: null }) as LeagueRow,
      userId
    ),
  };
}

/**
 * Calling one off, by whoever started it.
 *
 * A year is a long time to be wrong about, and there is no honest way to cut
 * a contest short: the result would cover a stretch nobody agreed to. So it is
 * deleted rather than shortened, and a settled battle cannot be touched at all.
 */
export async function cancelBattle(
  userId: string,
  cycleId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!canWriteGame) return { ok: false, error: "Battles are not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("cancel_battle", {
    p_user_id: userId,
    p_cycle_id: cycleId,
  });

  if (error) {
    if (error.message.includes("only the person")) {
      return {
        ok: false,
        error: "Only the person who started this battle can call it off.",
      };
    }
    if (error.message.includes("already finished")) {
      return { ok: false, error: "That battle has already been settled." };
    }
    return { ok: false, error: "We could not call that off. Try again." };
  }

  return { ok: true };
}

/** Whether trading is allowed in this battle right now, and why not if not. */
export function battleTrading(battle: Battle, now = new Date()): {
  open: boolean;
  reason: string;
} {
  if (battle.finished) {
    return { open: false, reason: "This battle is over. The result is above." };
  }

  if (battle.notStarted) {
    return {
      open: false,
      reason: "This battle starts on Monday. Nothing you do before then counts.",
    };
  }

  /*
    Past its last day but not yet settled.

    A contest is due the day after it ends and is scored by whoever notices,
    so there is always a stretch -- a few minutes, or a whole weekend -- where
    it has finished and its status still says open. For a market-hours battle
    that stretch is covered by the market being shut anyway. For one whose
    market never shuts it was not, so the form was enabled, the order was sent,
    and the database refused it. Being told no by a button that looked like yes
    is worse than the button being off.
  */
  if (nyDate(now) > battle.endsOn) {
    return {
      open: false,
      reason: "This battle has finished. The result lands once it is scored.",
    };
  }

  if (battle.format.tradingHours === "always") return { open: true, reason: "" };

  if (!isTradingOpen(now)) {
    return {
      open: false,
      reason:
        "The market is closed. Trading runs from 09:30 to 16:00 New York time, weekdays.",
    };
  }

  return { open: true, reason: "" };
}

/**
 * A battle, its table, and the viewer's own book, priced now.
 *
 * Cached for the length of one request: the battle room asks for it once to
 * title the page and once to draw it, and this is the most expensive read on
 * the screen.
 */
export const getBattleView = cache(async function getBattleView(
  userId: string,
  cycleId: string
): Promise<BattleView | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: cycleRow } = await admin
    .from("weekly_cycles")
    .select("*")
    .eq("id", cycleId)
    .maybeSingle();

  const cycle = cycleRow as WeeklyCycleRow | null;
  if (!cycle || !cycle.league_id) return null;

  const [{ data: members }, { data: leagueRow }, { data: played }] = await Promise.all([
    admin
      .from("league_members")
      .select("user_id, joined_at")
      .eq("league_id", cycle.league_id),
    admin.from("leagues").select("id, name, icon").eq("id", cycle.league_id).maybeSingle(),
    /*
      Anybody who has a book in this contest, whether or not they are still in
      the league. One of them may have left since, and dropping somebody who
      played would hand their result to whoever came behind them.
    */
    admin.from("portfolios").select("user_id").eq("cycle_id", cycle.id),
  ]);

  const roster = (members ?? []) as { user_id: string; joined_at: string }[];

  // Membership established from the roster rather than assumed from the url.
  // A cycle id is not a secret, and guessing one must not show a private room.
  if (!roster.some((row) => row.user_id === userId) || !leagueRow) return null;

  /*
    Who is in this contest, which is the same rule the notification about it
    uses -- because a room and a message that ranked different fields would say
    "second of six" and "second of four" about the same battle on the same
    evening.

    Everybody who played, plus everybody who was a member by the day it ended
    and did not. Somebody who joined the league afterwards was never in it.
  */
  const memberIds = [
    ...new Set([
      ...((played ?? []) as { user_id: string }[]).map((row) => row.user_id),
      ...roster
        .filter((row) => row.joined_at.slice(0, 10) <= cycle.ends_on)
        .map((row) => row.user_id),
    ]),
  ];

  const battle = toBattle(cycle, leagueRow as LeagueRow, userId);
  const format = battle.format;

  /*
    The opening price, if it was not known when the battle was started.

    Written in the background rather than on the way to the screen: it changes
    nothing anybody is looking at, and a battle that could not fill it in must
    still render. Nothing can be settled without it, and settlement asks again.
  */
  if (battle.benchmarkOpen == null && !battle.notStarted) {
    after(async () => {
      try {
        const open = await getSessionOpen(cycle.benchmark_symbol, cycle.monday);
        if (open != null) {
          await admin.rpc("set_benchmark_open", { p_cycle_id: cycle.id, p_open: open });
        }
      } catch {
        // The next visit tries again.
      }
    });
  }

  const [{ data: profiles }, { data: portfolios }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, handle, avatar_url")
      .in("id", memberIds),
    admin
      .from("portfolios")
      .select("id, user_id, cash, starting_balance")
      .eq("cycle_id", cycle.id)
      .in("user_id", memberIds),
  ]);

  const portfolioRows = (portfolios ?? []) as {
    id: string;
    user_id: string;
    cash: string;
    starting_balance: string;
  }[];
  const portfolioIds = portfolioRows.map((p) => p.id);

  const [{ data: holdings }, { data: trades }] = await Promise.all([
    portfolioIds.length
      ? admin
          .from("holdings")
          .select("portfolio_id, symbol, quantity, cost_basis")
          .in("portfolio_id", portfolioIds)
      : Promise.resolve({ data: [] as never[] }),
    portfolioIds.length
      ? admin.from("trades").select("portfolio_id").in("portfolio_id", portfolioIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const holdingRows = (holdings ?? []) as {
    portfolio_id: string;
    symbol: string;
    quantity: string;
    cost_basis: string;
  }[];

  const symbols = [...new Set(holdingRows.map((h) => h.symbol))];
  const quotes = await getQuotes([...symbols, cycle.benchmark_symbol]);

  const benchmarkQuote = quotes[cycle.benchmark_symbol] ?? null;
  const benchmarkOpen = battle.benchmarkOpen;

  /*
    A settled battle is measured on the numbers it was settled with, not on
    today's price. A finished result that drifted every time somebody opened
    it would not be a result.
  */
  const benchmarkReturnPercent =
    benchmarkOpen && benchmarkOpen > 0
      ? battle.benchmarkClose != null
        ? ((battle.benchmarkClose - benchmarkOpen) / benchmarkOpen) * 100
        : benchmarkQuote
          ? ((benchmarkQuote.price - benchmarkOpen) / benchmarkOpen) * 100
          : null
      : null;

  const tradedPortfolios = new Set(
    ((trades ?? []) as { portfolio_id: string }[]).map((t) => t.portfolio_id)
  );

  const holdingsByPortfolio = new Map<
    string,
    { symbol: string; quantity: number; costBasis: number }[]
  >();
  for (const row of holdingRows) {
    const list = holdingsByPortfolio.get(row.portfolio_id) ?? [];
    list.push({
      symbol: row.symbol,
      quantity: num(row.quantity),
      costBasis: num(row.cost_basis),
    });
    holdingsByPortfolio.set(row.portfolio_id, list);
  }

  const profileById = new Map(
    (
      (profiles ?? []) as {
        id: string;
        display_name: string | null;
        handle: string | null;
        avatar_url: string | null;
      }[]
    ).map((p) => [p.id, p])
  );

  const portfolioByUser = new Map(portfolioRows.map((p) => [p.user_id, p]));

  let anyStale = false;

  const rows = memberIds.map((memberId) => {
    const portfolio = portfolioByUser.get(memberId);
    const profile = profileById.get(memberId);

    // Somebody who has not opened this battle yet has no portfolio row. They
    // are shown level rather than hidden: a table with people missing from it
    // is not a table.
    const startingBalance = portfolio
      ? num(portfolio.starting_balance)
      : battle.startingBalance;
    const cash = portfolio ? num(portfolio.cash) : startingBalance;

    const held = portfolio ? (holdingsByPortfolio.get(portfolio.id) ?? []) : [];
    const holdingsValue = held.reduce((sum, position) => {
      const quote = quotes[position.symbol] ?? null;
      if (quote?.stale) anyStale = true;
      return (
        sum +
        positionValue(format, {
          quantity: position.quantity,
          costBasis: position.costBasis,
          price: quote?.price ?? null,
        })
      );
    }, 0);

    const totalValue = cash + holdingsValue;

    return {
      userId: memberId,
      displayName: profile?.display_name ?? "Player",
      handle: profile?.handle ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      totalValue,
      returnPercent:
        startingBalance > 0
          ? ((totalValue - startingBalance) / startingBalance) * 100
          : 0,
      isYou: memberId === userId,
      hasTraded: portfolio ? tradedPortfolios.has(portfolio.id) : false,
    };
  });

  rows.sort((a, b) => b.returnPercent - a.returnPercent);

  const standings: BattleStanding[] = rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    versusMarket:
      benchmarkReturnPercent == null ? null : row.returnPercent - benchmarkReturnPercent,
  }));

  const mine = portfolioByUser.get(userId);
  const myHoldings = mine ? (holdingsByPortfolio.get(mine.id) ?? []) : [];

  const positions: BattlePosition[] = myHoldings
    .map((position) => {
      const quote = quotes[position.symbol] ?? null;
      const value = positionValue(format, {
        quantity: position.quantity,
        costBasis: position.costBasis,
        price: quote?.price ?? null,
      });
      const gain = value - position.costBasis;

      return {
        symbol: position.symbol,
        quantity: position.quantity,
        costBasis: position.costBasis,
        averageCost: position.quantity > 0 ? position.costBasis / position.quantity : 0,
        quote,
        value,
        gain,
        gainPercent: position.costBasis > 0 ? (gain / position.costBasis) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const trading = battleTrading(battle);

  return {
    battle,
    standings,
    you: standings.find((row) => row.isYou) ?? null,
    benchmarkReturnPercent,
    positions,
    cash: mine ? num(mine.cash) : battle.startingBalance,
    tradingOpen: trading.open,
    closedReason: trading.reason,
    marketState: benchmarkQuote?.marketState ?? null,
    anyStale,
  };
});

/**
 * Just enough of a battle to check one trade against it.
 *
 * The battle room already builds the whole view -- every member's book, priced
 * from live quotes -- and a trade could perfectly well reuse it. It should
 * not: a server action is its own request, so placing an order in a league of
 * twenty would price twenty portfolios to decide whether one person may buy
 * one company. This reads the cycle, the roster and the buyer's own holdings,
 * which is all any format rule looks at.
 */
async function getTradeContext(
  userId: string,
  cycleId: string
): Promise<{ battle: Battle; positions: HeldPositionRow[] } | null> {
  const admin = createAdminClient();

  const { data: cycleRow } = await admin
    .from("weekly_cycles")
    .select("*")
    .eq("id", cycleId)
    .maybeSingle();

  const cycle = cycleRow as WeeklyCycleRow | null;
  if (!cycle || !cycle.league_id) return null;

  const [member, { data: leagueRow }] = await Promise.all([
    admin.rpc("is_league_member", {
      p_league_id: cycle.league_id,
      p_user_id: userId,
    }),
    admin
      .from("leagues")
      .select("id, name, icon")
      .eq("id", cycle.league_id)
      .maybeSingle(),
  ]);

  // Established from the roster rather than assumed from the id, which is not
  // a secret. The database refuses it a second time inside execute_trade.
  if (member.data !== true || !leagueRow) return null;

  const { data: portfolios } = await admin
    .from("portfolios")
    .select("id")
    .eq("cycle_id", cycle.id)
    .eq("user_id", userId)
    .limit(1);

  const portfolioId = ((portfolios ?? [])[0] as { id: string } | undefined)?.id;

  const { data: holdings } = portfolioId
    ? await admin
        .from("holdings")
        .select("symbol, quantity, cost_basis")
        .eq("portfolio_id", portfolioId)
    : { data: [] as never[] };

  return {
    battle: toBattle(cycle, leagueRow as LeagueRow, userId),
    positions: ((holdings ?? []) as {
      symbol: string;
      quantity: string;
      cost_basis: string;
    }[]).map((row) => ({
      symbol: row.symbol,
      quantity: num(row.quantity),
      costBasis: num(row.cost_basis),
    })),
  };
}

type HeldPositionRow = { symbol: string; quantity: number; costBasis: number };

/**
 * Battles that have been settled, for whoever has not been told yet.
 *
 * Deliberately returns every settled battle rather than only recent ones. The
 * caller is the notification pass, and what stops a year old result being
 * announced again is the dedupe key on the notification itself, which is the
 * one place that fact is actually recorded. A "since" window here would be a
 * second, weaker version of the same guard, and the two would disagree the
 * first time a schedule was missed.
 */
export async function settledBattles(): Promise<BattleResult[]> {
  if (!canWriteGame) return [];

  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("weekly_cycles")
    .select("id, league_id, format, ends_on, closed_at")
    .not("league_id", "is", null)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(50);

  const cycles = (rows ?? []) as {
    id: string;
    league_id: string;
    format: string;
    ends_on: string;
    closed_at: string | null;
  }[];

  if (cycles.length === 0) return [];

  const leagueIds = [...new Set(cycles.map((c) => c.league_id))];

  const [{ data: leagues }, { data: members }, { data: portfolios }] = await Promise.all([
    admin.from("leagues").select("id, name").in("id", leagueIds),
    admin
      .from("league_members")
      .select("league_id, user_id, joined_at")
      .in("league_id", leagueIds),
    admin
      .from("portfolios")
      .select("user_id, cycle_id, return_percent")
      .in("cycle_id", cycles.map((c) => c.id))
      .not("return_percent", "is", null),
  ]);

  const leagueName = new Map(
    ((leagues ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name])
  );

  const rosterByLeague = new Map<string, { userId: string; joined: string }[]>();
  for (const row of (members ?? []) as {
    league_id: string;
    user_id: string;
    joined_at: string;
  }[]) {
    const list = rosterByLeague.get(row.league_id) ?? [];
    list.push({ userId: row.user_id, joined: row.joined_at.slice(0, 10) });
    rosterByLeague.set(row.league_id, list);
  }

  const scoredByCycle = new Map<string, Map<string, number>>();
  for (const row of (portfolios ?? []) as {
    user_id: string;
    cycle_id: string;
    return_percent: string;
  }[]) {
    const forCycle = scoredByCycle.get(row.cycle_id) ?? new Map<string, number>();
    forCycle.set(row.user_id, num(row.return_percent));
    scoredByCycle.set(row.cycle_id, forCycle);
  }

  const everybody = [
    ...new Set([
      ...[...rosterByLeague.values()].flat().map((row) => row.userId),
      ...[...scoredByCycle.values()].flatMap((forCycle) => [...forCycle.keys()]),
    ]),
  ];

  const { data: profiles } = everybody.length
    ? await admin.from("profiles").select("id, display_name").in("id", everybody)
    : { data: [] as never[] };

  const nameById = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null }[]).map((p) => [
      p.id,
      p.display_name ?? "Player",
    ])
  );

  return cycles.flatMap((cycle) => {
    const scored = scoredByCycle.get(cycle.id) ?? new Map<string, number>();

    /*
      Nobody played it, so there is nothing to announce.

      This guard was here, went missing when the field widened from "people
      with a portfolio" to "the league", and took a real result with it: a
      battle nobody opened became one where everybody was level at nothing and
      whoever the database returned first had won it.
    */
    if (scored.size === 0) return [];

    /*
      Who was in it, which is not the same as who is in the league now.

      Everybody who played -- they have a scored portfolio, and one of them may
      since have left, in which case dropping them would hand their win to
      whoever came second. Plus everybody who was a member by the day it ended
      and did not open it, who is shown level in the room for the same reason a
      league table does not hide people.

      What that leaves out is somebody who joined the league afterwards. They
      were never in this contest, and telling them where they came in it would
      be a placing in a race they had not entered.
    */
    const entitled = (rosterByLeague.get(cycle.league_id) ?? [])
      .filter((row) => row.joined <= cycle.ends_on)
      .map((row) => row.userId);

    const field = [...new Set([...scored.keys(), ...entitled])];

    const finished = field
      .map((userId) => ({
        userId,
        displayName: nameById.get(userId) ?? "Player",
        returnPercent: scored.get(userId) ?? 0,
      }))
      .sort((a, b) => b.returnPercent - a.returnPercent);

    return [
      {
        cycleId: cycle.id,
        leagueId: cycle.league_id,
        leagueName: leagueName.get(cycle.league_id) ?? "your league",
        formatName: formatById(cycle.format).name,
        players: finished.length,
        winner: finished[0],
        finished,
      },
    ];
  });
}

export type BattleTradeOutcome =
  | { ok: true; symbol: string; side: "buy" | "sell"; quantity: number; price: number }
  | { ok: false; error: string };

/**
 * A trade inside a battle, at the price the server sees and under the format's
 * rules.
 *
 * The rules are checked here and enforced by the database underneath: the
 * direction is on the cycle, so a short cannot be opened in one contest and
 * settled as a purchase in another. What this adds on top is everything a
 * format says about what may be owned, which the database has no opinion about
 * because the lists are code.
 */
export async function placeBattleTrade(
  userId: string,
  cycleId: string,
  input: { symbol: string; side: "buy" | "sell"; quantity: number }
): Promise<BattleTradeOutcome> {
  if (!canWriteGame) {
    return { ok: false, error: "Battles are not switched on yet." };
  }

  const symbol = normaliseSymbol(input.symbol);

  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
    return { ok: false, error: "That does not look like something we can find." };
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: "Enter a whole number of shares." };
  }

  const context = await getTradeContext(userId, cycleId);
  if (!context) return { ok: false, error: "We could not find that battle." };

  const trading = battleTrading(context.battle);
  if (!trading.open) return { ok: false, error: trading.reason };

  const quotes = await getQuotes([symbol]);
  const quote = quotes[symbol];

  if (!quote) {
    return { ok: false, error: `We could not find a price for ${symbol}.` };
  }

  // A stale price is a price nobody should be filled at. Refusing is fairer
  // than filling everyone at a number that stopped being true.
  if (quote.stale) {
    return {
      ok: false,
      error: "Prices are not updating right now. Try again in a minute.",
    };
  }

  const allowed = checkTrade(context.battle.format, {
    symbol,
    side: input.side,
    quantity: input.quantity,
    price: quote.price,
    startingBalance: context.battle.startingBalance,
    positions: context.positions,
    quoteType: quote.type,
  });

  if (!allowed.ok) return { ok: false, error: allowed.error };

  const admin = createAdminClient();
  const { error } = await admin.rpc("execute_trade", {
    p_user_id: userId,
    p_cycle_id: cycleId,
    p_symbol: symbol,
    p_side: input.side,
    p_quantity: input.quantity,
    p_price: quote.price,
    p_max_per_minute: MAX_TRADES_PER_MINUTE,
    p_max_per_cycle: MAX_TRADES_PER_CYCLE,
    p_today: nyDate(),
  });

  if (error) return { ok: false, error: friendlyBattleError(error.message) };

  return {
    ok: true,
    symbol,
    side: input.side,
    quantity: input.quantity,
    price: quote.price,
  };
}

function friendlyBattleError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("not enough cash")) return "You do not have enough cash for that.";
  if (text.includes("do not own")) return "You do not hold that many.";
  if (text.includes("slow down")) return "That is a lot of trades at once. Give it a moment.";
  if (text.includes("trade limit")) return "You have hit the trade limit for this battle.";
  if (text.includes("has not started")) return "This battle has not started yet.";
  if (text.includes("closed for trading")) return "This battle is over.";
  if (text.includes("not a member")) return "You are not in this league any more.";
  if (text.includes("whole number")) return "Enter a whole number of shares.";
  return "We could not place that. Try again.";
}

/**
 * The rule book of a battle the caller is actually in.
 *
 * Two questions in one read, because they are always asked together: what may
 * be owned here, and is this person allowed to ask. Null answers both at once
 * and gives nothing away about which of the two failed.
 */
export async function battleFormat(
  userId: string,
  cycleId: string
): Promise<Format | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: cycleRow } = await admin
    .from("weekly_cycles")
    .select("format, league_id")
    .eq("id", cycleId)
    .maybeSingle();

  const cycle = cycleRow as { format: string; league_id: string | null } | null;
  if (!cycle?.league_id) return null;

  const member = await admin.rpc("is_league_member", {
    p_league_id: cycle.league_id,
    p_user_id: userId,
  });

  if (member.data !== true) return null;

  return formatById(cycle.format);
}

export { DEFAULT_FORMAT };
