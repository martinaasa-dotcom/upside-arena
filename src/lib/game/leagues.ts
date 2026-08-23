import "server-only";

import { cache } from "react";

import { limitsFor } from "@/lib/billing/plan";
import { hasPlus } from "@/lib/billing/entitlements";
import { MAX_LEAGUES_JOINED, MAX_LEAGUES_OWNED } from "@/lib/game";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { byResult, compareResults } from "@/lib/game/ranking";
import { getQuotes } from "@/lib/market/quotes";
import { BENCHMARK_SYMBOL } from "@/lib/game";
import { getCurrentCycle, type Cycle } from "@/lib/game/portfolio";
import { getMarksFor } from "@/lib/game/marks";
import { dayMove, lastCloseBefore } from "@/lib/game/shape";
import { hasOpenedToday, nyDate } from "@/lib/market/session";
import type { LeagueRow } from "@/lib/supabase/database.types";

/*
  Private leagues, and the standings inside them.

  Standings are built here rather than in the database because valuing a
  portfolio needs live prices, and Postgres has no business fetching those. It
  also keeps profile rows private: the server reads what it needs with the
  service role and hands back a name, a tag and a picture, so being in someone's
  league never becomes a way to read their rating or lifetime record.
*/

export type League = {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  inviteCode: string;
  maxMembers: number;
  memberCount: number;
  isOwner: boolean;
};

export type Standing = {
  userId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  rank: number;
  /** Cash plus everything held, priced now. */
  totalValue: number;
  returnPercent: number;

  /*
    What today alone has done to this portfolio, against last night's close.

    Null for everybody at once, never for one person in a row of people: at
    the weekend, before the bell, and on a Monday there is no close behind
    today to measure it against, so the column is simply not there rather
    than showing a table of zeroes.
  */
  todayPercent: number | null;
  /** Percentage points ahead of the market. Null until the market is known. */
  versusMarket: number | null;
  isYou: boolean;
  /** True once they have made at least one trade this week. */
  hasTraded: boolean;
};

export type LeagueStandings = {
  league: League;
  cycle: Cycle;
  standings: Standing[];
  benchmarkReturnPercent: number | null;
  /**
   * The one person immediately ahead of you.
   *
   * The plan is specific that comparison against a named person beats a list
   * of strangers, so this is surfaced separately rather than left for someone
   * to work out by reading up the table.
   */
  rival: { name: string; behindBy: number } | null;
};

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function toLeague(row: LeagueRow, memberCount: number, viewerId: string): League {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    maxMembers: row.max_members,
    memberCount,
    isOwner: row.owner_id === viewerId,
  };
}

/** Every league a player is in, with how many people are in each. */
export async function getLeagues(userId: string): Promise<League[]> {
  if (!canWriteGame) return [];

  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);

  const ids = (memberships ?? []).map((m) => m.league_id as string);
  if (ids.length === 0) return [];

  const [{ data: leagues }, { data: everyone }] = await Promise.all([
    admin.from("leagues").select("*").in("id", ids),
    admin.from("league_members").select("league_id").in("league_id", ids),
  ]);

  const counts = new Map<string, number>();
  for (const row of everyone ?? []) {
    const id = row.league_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return ((leagues ?? []) as LeagueRow[])
    .map((row) => toLeague(row, counts.get(row.id) ?? 1, userId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The league table for the week in progress, priced now.
 *
 * Everyone in the league is valued from one batch of quotes, so a league of
 * twenty people holding the same handful of companies costs a handful of
 * requests, not twenty.
 */
/*
  Cached for the length of one request. The league screen asks for this twice,
  once to put the league's name in the page title and once to draw the table,
  and this is the most expensive read in the app: every member's portfolio,
  every holding, and a batch of live quotes. Doing all of that twice for one
  screen doubled how long the room took to arrive for nothing.
*/
export const getLeagueStandings = cache(async function getLeagueStandings(
  userId: string,
  leagueId: string
): Promise<LeagueStandings | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  /*
    The roster, the league and the week, asked for together.

    This used to walk: check that the viewer is a member, then count the
    members, then read the league, then find the week, then list the members
    again. Three of those five are the same question and none of them needs
    an answer from any other, so they go out at once and the roster is read
    once instead of twice.

    Reading the league row before the membership check leaks nothing: it is
    read with the service role, on the server, and discarded unread if the
    viewer turns out not to belong here.
  */
  const [{ data: members }, { data: leagueRow }, cycle] = await Promise.all([
    admin.from("league_members").select("user_id").eq("league_id", leagueId),
    admin.from("leagues").select("*").eq("id", leagueId).maybeSingle(),
    getCurrentCycle(),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id as string);
  if (memberIds.length === 0) return null;

  /*
    Membership is established here, from the roster we already have, rather
    than assumed from the URL. A league id is not a secret, and guessing one
    must not show you a private league.
  */
  if (!memberIds.includes(userId)) return null;
  if (!leagueRow) return null;
  if (!cycle) return null;

  const league = toLeague(leagueRow as LeagueRow, memberIds.length, userId);

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

  const portfolioIds = (portfolios ?? []).map((p) => p.id as string);

  const [{ data: holdings }, { data: trades }] = await Promise.all([
    portfolioIds.length
      ? admin
          .from("holdings")
          .select("portfolio_id, symbol, quantity")
          .in("portfolio_id", portfolioIds)
      : Promise.resolve({ data: [] as never[] }),
    portfolioIds.length
      ? admin.from("trades").select("portfolio_id").in("portfolio_id", portfolioIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const symbols = [
    ...new Set(((holdings ?? []) as { symbol: string }[]).map((h) => h.symbol)),
  ];

  /*
    Prices, and every close already in the book for this room.

    The closes are what turn a weekly table into one worth opening on a
    Wednesday. A league that has been running since Monday barely reorders --
    the person who is up four per cent is still up four per cent -- while the
    day inside it has somebody having a good one, and that is the part worth
    coming back for.

    One request for the whole roster, not one per member.
  */
  const [quotes, marksByPortfolio] = await Promise.all([
    getQuotes([...symbols, BENCHMARK_SYMBOL]),
    getMarksFor(portfolioIds),
  ]);

  /*
    Whether today is a day at all. Before the bell and at the weekend nothing
    has happened since the last close, so the column is left off entirely
    rather than filled with a row of noughts.
  */
  const today = nyDate();
  const dayIsOn = hasOpenedToday();

  const benchmarkQuote = quotes[BENCHMARK_SYMBOL] ?? null;
  const benchmarkReturnPercent =
    cycle.benchmark_open && cycle.benchmark_open > 0 && benchmarkQuote
      ? ((benchmarkQuote.price - cycle.benchmark_open) / cycle.benchmark_open) * 100
      : null;

  const tradedPortfolios = new Set(
    ((trades ?? []) as { portfolio_id: string }[]).map((t) => t.portfolio_id)
  );

  const holdingsByPortfolio = new Map<string, { symbol: string; quantity: number }[]>();
  for (const row of (holdings ?? []) as {
    portfolio_id: string;
    symbol: string;
    quantity: string;
  }[]) {
    const list = holdingsByPortfolio.get(row.portfolio_id) ?? [];
    list.push({ symbol: row.symbol, quantity: num(row.quantity) });
    holdingsByPortfolio.set(row.portfolio_id, list);
  }

  const profileById = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null; handle: string | null; avatar_url: string | null }[]).map(
      (p) => [p.id, p]
    )
  );

  // Indexed once rather than scanned per member, which was a full pass over
  // the league for every row of it.
  const portfolioByUser = new Map(
    ((portfolios ?? []) as {
      id: string;
      user_id: string;
      cash: string;
      starting_balance: string;
    }[]).map((p) => [p.user_id, p])
  );

  const rows = memberIds.map((memberId) => {
    const portfolio = portfolioByUser.get(memberId);

    const profile = profileById.get(memberId);

    /*
      Someone who has not opened the app this week has no portfolio row yet.
      They are shown at the starting balance rather than hidden, because a
      league table with people missing from it is not a league table.
    */
    const startingBalance = portfolio
      ? num(portfolio.starting_balance)
      : cycle.starting_balance;
    const cash = portfolio ? num(portfolio.cash) : startingBalance;

    const held = portfolio ? (holdingsByPortfolio.get(portfolio.id) ?? []) : [];
    const holdingsValue = held.reduce((sum, h) => {
      const quote = quotes[h.symbol];
      return sum + (quote ? h.quantity * quote.price : 0);
    }, 0);

    const totalValue = cash + holdingsValue;

    const move =
      dayIsOn && portfolio
        ? dayMove(
            totalValue,
            lastCloseBefore(marksByPortfolio.get(portfolio.id) ?? [], today)
          )
        : null;

    return {
      userId: memberId,
      todayPercent: move ? move.percent : null,
      displayName: profile?.display_name ?? "Player",
      handle: profile?.handle ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      totalValue,
      returnPercent:
        startingBalance > 0 ? ((totalValue - startingBalance) / startingBalance) * 100 : 0,
      isYou: memberId === userId,
      hasTraded: portfolio ? tradedPortfolios.has(portfolio.id) : false,
    };
  });

  const ordered = byResult(rows);

  const standings: Standing[] = ordered.map((row, index) => ({
    ...row,
    rank: index + 1,
    versusMarket:
      benchmarkReturnPercent == null ? null : row.returnPercent - benchmarkReturnPercent,
  }));

  const youIndex = standings.findIndex((s) => s.isYou);
  const ahead = youIndex > 0 ? standings[youIndex - 1] : null;

  return {
    league,
    cycle,
    standings,
    benchmarkReturnPercent,
    rival:
      ahead && youIndex >= 0
        ? {
            name: ahead.displayName,
            behindBy: ahead.returnPercent - standings[youIndex].returnPercent,
          }
        : null,
  };
});

export type LeagueOutcome =
  | { ok: true; league: LeagueRow }
  | { ok: false; error: string };

export async function createLeague(
  userId: string,
  name: string,
  icon: string | null
): Promise<LeagueOutcome> {
  if (!canWriteGame) return { ok: false, error: "Leagues are not switched on yet." };

  /*
    How many they may run, and how big. A subscriber gets more of both, which
    is a convenience rather than an advantage: a bigger league is more people
    to be beaten by, and nothing about it changes how a week is scored.
  */
  const limits = limitsFor(await hasPlus(userId));

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_league", {
    p_user_id: userId,
    p_name: name,
    p_icon: icon,
    p_max_leagues: limits.leaguesOwned,
    p_max_members: limits.leagueMembers,
  });

  if (error) {
    if (error.message.includes("league limit reached")) {
      return {
        ok: false,
        error:
          limits.leaguesOwned > MAX_LEAGUES_OWNED
            ? `You can run ${limits.leaguesOwned} leagues at once. Leave one to start another.`
            : `You can run ${limits.leaguesOwned} leagues at once. Leave one to start another, or take Arena Plus for more.`,
      };
    }
    if (error.message.includes("needs a name")) {
      return { ok: false, error: "Give your league a name." };
    }
    return { ok: false, error: "We could not make that league. Try again." };
  }

  return { ok: true, league: data as unknown as LeagueRow };
}

export async function joinLeague(
  userId: string,
  inviteCode: string
): Promise<LeagueOutcome> {
  if (!canWriteGame) return { ok: false, error: "Leagues are not switched on yet." };

  const limits = limitsFor(await hasPlus(userId));

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("join_league", {
    p_user_id: userId,
    p_invite_code: inviteCode,
    p_max_leagues: limits.leaguesJoined,
  });

  if (error) {
    if (error.message.includes("no league with that code")) {
      return { ok: false, error: "No league has that code. Check it and try again." };
    }
    if (error.message.includes("full")) {
      return { ok: false, error: "That league is full." };
    }
    if (error.message.includes("too many leagues")) {
      return {
        ok: false,
        error:
          limits.leaguesJoined > MAX_LEAGUES_JOINED
            ? `You are in ${limits.leaguesJoined} leagues already. Leave one to join another.`
            : `You are in ${limits.leaguesJoined} leagues already. Leave one to join another, or take Arena Plus for more.`,
      };
    }
    return { ok: false, error: "We could not join that league. Try again." };
  }

  return { ok: true, league: data as unknown as LeagueRow };
}

export async function leaveLeague(
  userId: string,
  leagueId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!canWriteGame) return { ok: false, error: "Leagues are not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("leave_league", {
    p_user_id: userId,
    p_league_id: leagueId,
  });

  if (error) return { ok: false, error: "We could not leave that league. Try again." };
  return { ok: true };
}

/** Where somebody stands in one league, for a list of them. */
export type LeaguePosition = {
  leagueId: string;
  rank: number;
  players: number;
  returnPercent: number;
  /** Whoever is top, unless that is the viewer. */
  leader: { displayName: string; returnPercent: number } | null;
};

/**
 * Where a player stands in every league at once.
 *
 * The leagues screen was a list of names and member counts, which is the one
 * thing somebody opening it already knows. What they want is where they are
 * standing in each, and the obvious way to get that -- asking
 * getLeagueStandings once per league -- is six database round trips each, ten
 * times over for somebody on the free tier's limit.
 *
 * So this asks the same questions once, across every league together: one
 * roster, one set of portfolios, one set of holdings, one batch of quotes.
 * Four round trips whether somebody is in one league or ten, and the quote
 * layer shares the prices with whatever else is on the screen.
 *
 * Nothing here is a second opinion about the league screen's table. It is the
 * same arithmetic on the same rows, which is why it lives in this file beside
 * it rather than somewhere it could drift.
 */
export async function getLeaguePositions(
  userId: string,
  leagueIds: readonly string[]
): Promise<Map<string, LeaguePosition>> {
  const out = new Map<string, LeaguePosition>();
  if (!canWriteGame || leagueIds.length === 0) return out;

  const admin = createAdminClient();

  const [{ data: members }, cycle] = await Promise.all([
    admin
      .from("league_members")
      .select("league_id, user_id")
      .in("league_id", [...leagueIds]),
    getCurrentCycle(),
  ]);

  const roster = (members ?? []) as { league_id: string; user_id: string }[];
  if (roster.length === 0 || !cycle) return out;

  const everybody = [...new Set(roster.map((row) => row.user_id))];

  const [{ data: profiles }, { data: portfolios }] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", everybody),
    admin
      .from("portfolios")
      .select("id, user_id, cash, starting_balance")
      .eq("cycle_id", cycle.id)
      .in("user_id", everybody),
  ]);

  const portfolioRows = (portfolios ?? []) as {
    id: string;
    user_id: string;
    cash: string;
    starting_balance: string;
  }[];

  const { data: holdings } = portfolioRows.length
    ? await admin
        .from("holdings")
        .select("portfolio_id, symbol, quantity")
        .in(
          "portfolio_id",
          portfolioRows.map((p) => p.id)
        )
    : { data: [] as never[] };

  const holdingRows = (holdings ?? []) as {
    portfolio_id: string;
    symbol: string;
    quantity: string;
  }[];

  const quotes = await getQuotes([...new Set(holdingRows.map((h) => h.symbol))]);

  const valueByPortfolio = new Map<string, number>();
  for (const row of holdingRows) {
    const quote = quotes[row.symbol];
    if (!quote) continue;
    valueByPortfolio.set(
      row.portfolio_id,
      (valueByPortfolio.get(row.portfolio_id) ?? 0) + num(row.quantity) * quote.price
    );
  }

  const nameById = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null }[]).map((p) => [
      p.id,
      p.display_name ?? "Player",
    ])
  );

  const returnByUser = new Map<string, number>();
  const portfolioByUser = new Map(portfolioRows.map((p) => [p.user_id, p]));

  for (const id of everybody) {
    const portfolio = portfolioByUser.get(id);

    /*
      Somebody who has not opened the app this week has no portfolio row and is
      counted at the starting balance, exactly as the league table counts them.
      A list that quietly left them out would put somebody second of four on
      one screen and second of five on the next.
    */
    const startingBalance = portfolio
      ? num(portfolio.starting_balance)
      : cycle.starting_balance;
    const total = portfolio
      ? num(portfolio.cash) + (valueByPortfolio.get(portfolio.id) ?? 0)
      : startingBalance;

    returnByUser.set(
      id,
      startingBalance > 0 ? ((total - startingBalance) / startingBalance) * 100 : 0
    );
  }

  const byLeague = new Map<string, string[]>();
  for (const row of roster) {
    const list = byLeague.get(row.league_id) ?? [];
    list.push(row.user_id);
    byLeague.set(row.league_id, list);
  }

  for (const [leagueId, ids] of byLeague) {
    // userId rather than id, so this row is the shape compareResults ranks
    // and this league's ordering is the same one the league's own room shows.
    const ranked = ids
      .map((id) => ({ userId: id, returnPercent: returnByUser.get(id) ?? 0 }))
      .sort(compareResults);

    const index = ranked.findIndex((row) => row.userId === userId);
    if (index < 0) continue;

    const top = ranked[0];

    out.set(leagueId, {
      leagueId,
      rank: index + 1,
      players: ranked.length,
      returnPercent: ranked[index].returnPercent,
      leader:
        top.userId === userId
          ? null
          : {
              displayName: nameById.get(top.userId) ?? "Player",
              returnPercent: top.returnPercent,
            },
    });
  }

  return out;
}
