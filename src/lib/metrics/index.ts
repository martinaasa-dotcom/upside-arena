import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { nyDate } from "@/lib/market/session";

export { percentOf } from "@/lib/metrics/ratio";

/*
  The four numbers section 2.8 says the loop is tuned by.

  Computed from data Arena already holds rather than sent to an analytics
  vendor. That is not squeamishness. Shipping every player's trades and
  standings to a third party to answer four questions we can answer ourselves
  would add a processor, a disclosure and a leak surface for nothing, and it
  would only cover the minority who agreed to measurement. These numbers are
  true for everybody, because they are counts of what actually happened.

  What the client events measure instead is intent: which buttons were
  pressed, which screens were opened, which prompts were refused. Neither
  half answers the other's questions.
*/

export type Retention = { windowDays: number; cohort: number; returned: number }[];

export type Metrics = {
  asOf: string;
  retention: Retention;
  streaks: {
    players: number;
    alive: number;
    reachedFive: number;
    reachedTwenty: number;
    longest: number;
    freezesSpent: number;
  };
  leagues: {
    leagues: number;
    alone: number;
    withCompany: number;
    members: number;
    biggest: number;
  };
  engagement: {
    players: number;
    onboarded: number;
    traded: number;
    inALeague: number;
    weeksScored: number;
    weeksShared: number;
    cardsLive: number;
    activeToday: number;
    activeThisWeek: number;
  };
};

const EMPTY: Metrics = {
  asOf: "",
  retention: [],
  streaks: {
    players: 0,
    alive: 0,
    reachedFive: 0,
    reachedTwenty: 0,
    longest: 0,
    freezesSpent: 0,
  },
  leagues: { leagues: 0, alone: 0, withCompany: 0, members: 0, biggest: 0 },
  engagement: {
    players: 0,
    onboarded: 0,
    traded: 0,
    inALeague: 0,
    weeksScored: 0,
    weeksShared: 0,
    cardsLive: 0,
    activeToday: 0,
    activeThisWeek: 0,
  },
};

/** Notes that somebody opened Arena today. Counted once per calendar day. */
export async function recordDailyActive(userId: string): Promise<void> {
  if (!canWriteGame) return;

  const admin = createAdminClient();
  await admin.rpc("record_daily_active", { p_user_id: userId, p_date: nyDate() });
}

export async function getMetrics(): Promise<Metrics> {
  if (!canWriteGame) return EMPTY;

  const admin = createAdminClient();
  const today = nyDate();

  const [retention, streaks, leagues, engagement] = await Promise.all([
    admin.rpc("metrics_retention", { p_today: today }),
    admin.rpc("metrics_streaks"),
    admin.rpc("metrics_leagues"),
    admin.rpc("metrics_engagement", { p_today: today }),
  ]);

  const one = <T,>(result: { data: unknown }): T | null => {
    const rows = result.data as T[] | null;
    return Array.isArray(rows) ? (rows[0] ?? null) : null;
  };

  const s = one<Metrics["streaks"] & Record<string, number>>(streaks);
  const l = one<Record<string, number>>(leagues);
  const e = one<Record<string, number>>(engagement);

  return {
    asOf: today,
    retention: ((retention.data ?? []) as {
      window_days: number;
      cohort: number;
      returned: number;
    }[]).map((row) => ({
      windowDays: row.window_days,
      cohort: row.cohort,
      returned: row.returned,
    })),
    streaks: {
      players: s?.players ?? 0,
      alive: s?.alive ?? 0,
      reachedFive: s?.reached_five ?? 0,
      reachedTwenty: s?.reached_twenty ?? 0,
      longest: s?.longest ?? 0,
      freezesSpent: s?.freezes_spent ?? 0,
    },
    leagues: {
      leagues: l?.leagues ?? 0,
      alone: l?.alone ?? 0,
      withCompany: l?.with_company ?? 0,
      members: l?.members ?? 0,
      biggest: l?.biggest ?? 0,
    },
    engagement: {
      players: e?.players ?? 0,
      onboarded: e?.onboarded ?? 0,
      traded: e?.traded ?? 0,
      inALeague: e?.in_a_league ?? 0,
      weeksScored: e?.weeks_scored ?? 0,
      weeksShared: e?.weeks_shared ?? 0,
      cardsLive: e?.cards_live ?? 0,
      activeToday: e?.active_today ?? 0,
      activeThisWeek: e?.active_this_week ?? 0,
    },
  };
}
