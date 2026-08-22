import "server-only";

import { cache } from "react";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeagueRow, WeeklyCycleRow } from "@/lib/supabase/database.types";

/*
  What a league remembers.

  Everything else about a league is this week. Monday resets it, Friday scores
  it, and by the following Tuesday nothing anywhere records that it happened.
  That is right for the game -- it is what keeps somebody who joined last night
  level with somebody who has played for a year -- and it is exactly wrong for
  the reason people stay: nobody argues about a table that forgets.

  So a league keeps a record. Who won each week. How many weeks each person
  has won. And, the one that actually gets read, how you have done against
  each other person one at a time.

  Nothing here is stored or scored. Every number below was settled on some
  Friday and written to a portfolio at the time; this file reads those rows
  and counts them. That is deliberate, and it is the same rule the season
  table follows: a record worked out live could disagree with the week it came
  from, and two versions of one result is the fastest way to lose somebody's
  trust in both.

  One rule is worth stating because it is the only judgement call here. A week
  counts for somebody if they had joined the league by the day that week
  ended. Weeks played before they arrived are not weeks they lost, and a
  head-to-head that counted them would be a made-up scoreline -- which this
  product does not do anywhere else either.
*/

/** How many weeks the compact strip on the league page shows. */
export const FORM_WEEKS = 5;

export type RecordedWeek = {
  cycleId: string;
  monday: string;
  /** How many members of this league were scored that week. */
  players: number;
  /** The market's own move that week, if it was recorded. */
  benchmarkReturn: number | null;
  winner: { userId: string; displayName: string; returnPercent: number } | null;
  /** Where the viewer came, and what they made. Null if they did not play. */
  you: { rank: number; returnPercent: number; versusMarket: number | null } | null;
};

export type Honour = {
  userId: string;
  displayName: string;
  handle: string | null;
  /** Weeks finished first in this league. */
  wins: number;
  /** Weeks played in this league at all. */
  weeks: number;
  /** Weeks finished ahead of the market. */
  weeksAhead: number;
  /** Points ahead of the market, per week played. */
  averageVersusMarket: number;
  bestWeek: number | null;
  isYou: boolean;
};

export type HeadToHead = {
  userId: string;
  displayName: string;
  /** Weeks where both were scored and the viewer finished above them. */
  won: number;
  lost: number;
  /** Weeks both of them played. Won plus lost, barring an exact tie. */
  together: number;
};

export type LeagueRecord = {
  league: Pick<LeagueRow, "id" | "name" | "icon">;
  /** Newest first. */
  weeks: RecordedWeek[];
  honours: Honour[];
  headToHead: HeadToHead[];
  /** The viewer's own row on the honours board, which may be below the fold. */
  you: Honour | null;
};

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

/**
 * A league's whole record, or nothing if the viewer is not in it.
 *
 * Cached for the length of one request: the league page reads the last few
 * weeks of it and the record room reads all of it, and both may render in the
 * same request when one is prefetched from the other.
 */
export const getLeagueRecord = cache(async function getLeagueRecord(
  userId: string,
  leagueId: string
): Promise<LeagueRecord | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const [{ data: members }, { data: leagueRow }] = await Promise.all([
    admin
      .from("league_members")
      .select("user_id, joined_at")
      .eq("league_id", leagueId),
    admin.from("leagues").select("id, name, icon").eq("id", leagueId).maybeSingle(),
  ]);

  const roster = (members ?? []) as { user_id: string; joined_at: string }[];
  const memberIds = roster.map((m) => m.user_id);

  // Membership from the roster rather than from the url. A league id is not a
  // secret, and guessing one must not show you a private league's history.
  if (!memberIds.includes(userId) || !leagueRow) return null;

  const joinedBy = new Map(roster.map((m) => [m.user_id, m.joined_at.slice(0, 10)]));

  /*
    Every house week that has been settled. Battles are left out on purpose:
    they have their own rule books and their own benchmarks, so counting a
    short-only fortnight as a week somebody won would be adding up two
    different games.
  */
  const { data: cycleRows } = await admin
    .from("weekly_cycles")
    .select("id, monday, ends_on, benchmark_open, benchmark_close")
    .is("league_id", null)
    .eq("status", "closed")
    .order("monday", { ascending: false });

  const cycles = (cycleRows ?? []) as Pick<
    WeeklyCycleRow,
    "id" | "monday" | "ends_on" | "benchmark_open" | "benchmark_close"
  >[];

  if (cycles.length === 0) {
    return {
      league: leagueRow as LeagueRow,
      weeks: [],
      honours: [],
      headToHead: [],
      you: null,
    };
  }

  const [{ data: scored }, { data: profiles }] = await Promise.all([
    admin
      .from("portfolios")
      .select("user_id, cycle_id, return_percent, benchmark_diff")
      .in("user_id", memberIds)
      .in(
        "cycle_id",
        cycles.map((c) => c.id)
      )
      .not("return_percent", "is", null),
    admin
      .from("profiles")
      .select("id, display_name, handle")
      .in("id", memberIds),
  ]);

  const nameById = new Map(
    (
      (profiles ?? []) as {
        id: string;
        display_name: string | null;
        handle: string | null;
      }[]
    ).map((p) => [p.id, p])
  );

  const byCycle = new Map<
    string,
    { userId: string; returnPercent: number; versusMarket: number }[]
  >();

  for (const row of (scored ?? []) as {
    user_id: string;
    cycle_id: string;
    return_percent: string;
    benchmark_diff: string | null;
  }[]) {
    const list = byCycle.get(row.cycle_id) ?? [];
    list.push({
      userId: row.user_id,
      returnPercent: num(row.return_percent),
      versusMarket: num(row.benchmark_diff),
    });
    byCycle.set(row.cycle_id, list);
  }

  const tally = new Map<
    string,
    { wins: number; weeks: number; weeksAhead: number; sumVersus: number; best: number | null }
  >();

  const versus = new Map<string, { won: number; lost: number; together: number }>();
  const weeks: RecordedWeek[] = [];

  for (const cycle of cycles) {
    /*
      Only the people who were in the league when the week ended. Somebody who
      joined last Tuesday did not lose the twelve weeks before that, and a
      head-to-head that said they did would be a scoreline nobody played.
    */
    const played = (byCycle.get(cycle.id) ?? []).filter((row) => {
      const joined = joinedBy.get(row.userId);
      return joined != null && joined <= cycle.ends_on;
    });

    if (played.length === 0) continue;

    played.sort((a, b) => b.returnPercent - a.returnPercent);

    for (const [index, row] of played.entries()) {
      const entry = tally.get(row.userId) ?? {
        wins: 0,
        weeks: 0,
        weeksAhead: 0,
        sumVersus: 0,
        best: null,
      };

      entry.weeks += 1;
      if (index === 0) entry.wins += 1;
      if (row.versusMarket > 0) entry.weeksAhead += 1;
      entry.sumVersus += row.versusMarket;
      entry.best = entry.best == null ? row.returnPercent : Math.max(entry.best, row.returnPercent);

      tally.set(row.userId, entry);
    }

    const mine = played.find((row) => row.userId === userId);

    if (mine) {
      for (const row of played) {
        if (row.userId === userId) continue;

        const entry = versus.get(row.userId) ?? { won: 0, lost: 0, together: 0 };
        entry.together += 1;
        // An exact tie to four decimal places counts for neither, which is
        // rarer than it sounds and still has to add up when it happens.
        if (mine.returnPercent > row.returnPercent) entry.won += 1;
        else if (mine.returnPercent < row.returnPercent) entry.lost += 1;
        versus.set(row.userId, entry);
      }
    }

    const open = cycle.benchmark_open == null ? null : num(cycle.benchmark_open);
    const close = cycle.benchmark_close == null ? null : num(cycle.benchmark_close);
    const benchmarkReturn =
      open != null && close != null && open > 0 ? ((close - open) / open) * 100 : null;

    const top = played[0];

    weeks.push({
      cycleId: cycle.id,
      monday: cycle.monday,
      players: played.length,
      benchmarkReturn,
      winner: {
        userId: top.userId,
        displayName: nameById.get(top.userId)?.display_name ?? "Player",
        returnPercent: top.returnPercent,
      },
      you: mine
        ? {
            rank: played.findIndex((row) => row.userId === userId) + 1,
            returnPercent: mine.returnPercent,
            versusMarket: benchmarkReturn == null ? null : mine.versusMarket,
          }
        : null,
    });
  }

  const honours: Honour[] = [...tally.entries()]
    .map(([id, entry]) => ({
      userId: id,
      displayName: nameById.get(id)?.display_name ?? "Player",
      handle: nameById.get(id)?.handle ?? null,
      wins: entry.wins,
      weeks: entry.weeks,
      weeksAhead: entry.weeksAhead,
      averageVersusMarket: entry.weeks > 0 ? entry.sumVersus / entry.weeks : 0,
      bestWeek: entry.best,
      isYou: id === userId,
    }))
    /*
      Ordered on weeks won, because that is what the honours board is for and
      it is the number people say out loud. Ties break on how far ahead of the
      market they were, which is the season's measure and the fairer of the
      two: winning three weeks out of four beats winning three out of forty.
    */
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.averageVersusMarket - a.averageVersusMarket;
    });

  const headToHead: HeadToHead[] = [...versus.entries()]
    .map(([id, entry]) => ({
      userId: id,
      displayName: nameById.get(id)?.display_name ?? "Player",
      ...entry,
    }))
    .sort((a, b) => b.together - a.together);

  return {
    league: leagueRow as LeagueRow,
    weeks,
    honours,
    headToHead,
    you: honours.find((row) => row.isYou) ?? null,
  };
});
