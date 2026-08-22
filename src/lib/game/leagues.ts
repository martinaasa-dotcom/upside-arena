import "server-only";

import { cache } from "react";

import { limitsFor } from "@/lib/billing/plan";
import { hasPlus } from "@/lib/billing/entitlements";
import { MAX_LEAGUES_JOINED, MAX_LEAGUES_OWNED } from "@/lib/game";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuotes } from "@/lib/market/quotes";
import { BENCHMARK_SYMBOL } from "@/lib/game";
import { getCurrentCycle, type Cycle } from "@/lib/game/portfolio";
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

export async function getLeague(
  userId: string,
  leagueId: string
): Promise<League | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  // Membership is checked here, not assumed from the URL. A league id is not
  // a secret, and guessing one must not show you a private league.
  const { data: member } = await admin
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return null;

  const [{ data: league }, { count }] = await Promise.all([
    admin.from("leagues").select("*").eq("id", leagueId).maybeSingle(),
    admin
      .from("league_members")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId),
  ]);

  if (!league) return null;
  return toLeague(league as LeagueRow, count ?? 1, userId);
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
  const league = await getLeague(userId, leagueId);
  if (!league) return null;

  const cycle = await getCurrentCycle();
  if (!cycle) return null;

  const admin = createAdminClient();

  const { data: members } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);

  const memberIds = (members ?? []).map((m) => m.user_id as string);
  if (memberIds.length === 0) return null;

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
  const quotes = await getQuotes([...symbols, BENCHMARK_SYMBOL]);

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

  const rows = memberIds.map((memberId) => {
    const portfolio = ((portfolios ?? []) as {
      id: string;
      user_id: string;
      cash: string;
      starting_balance: string;
    }[]).find((p) => p.user_id === memberId);

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

    return {
      userId: memberId,
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

  rows.sort((a, b) => b.returnPercent - a.returnPercent);

  const standings: Standing[] = rows.map((row, index) => ({
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
