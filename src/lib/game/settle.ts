import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClosingPrices, getSessionOpen } from "@/lib/market/benchmark";
import { nyDate } from "@/lib/market/session";
import { settleDuePods } from "@/lib/game/pods";
import type { SeasonRow, WeeklyCycleRow } from "@/lib/supabase/database.types";

/*
  Settling a finished week.

  Deliberately not built on a scheduler. Vercel's Hobby plan runs a cron once
  a day at an hour it chooses, which cannot be relied on to fire after
  Friday's close, and paying for a scheduler to do something the app can
  notice for itself is the wrong trade.

  Instead, three layers:

  1. Any request that touches the game settles a due week in the background,
     so correctness never waits for a timer. This is the guarantee.
  2. A claim in the database, so however many requests notice at once, one
     does the work.
  3. An optional outside nudge at /api/cron/settle, so a week still settles
     promptly on a quiet weekend when nobody visits.

  Scoring is idempotent, so every one of those can safely happen twice.
*/

/** How long a claim may sit before another settler may take it over. */
const STALE_CLAIM = "10 minutes";

export type SettlementResult = {
  cycleId: string;
  monday: string;
  status: "settled" | "claimed-elsewhere" | "no-prices" | "failed";
  portfolios?: number;
  detail?: string;
};

function num(value: string | number | null): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * The Friday a week ended on: its Monday plus four days.
 *
 * Kept for the house week, whose end has always been derivable. A battle can
 * run a day or a year, so its end date is recorded on the row and read from
 * there -- see settleCycle, which prefers ends_on and falls back to this.
 */
export function cycleFriday(monday: string): string {
  const start = new Date(`${monday}T12:00:00Z`);
  const friday = new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000);
  return friday.toISOString().slice(0, 10);
}

/**
 * Settles every week that has finished and not been scored.
 *
 * Safe to call from anywhere, as often as you like.
 */
export async function settleDueCycles(): Promise<SettlementResult[]> {
  if (!canWriteGame) return [];

  const admin = createAdminClient();

  const { data: due, error } = await admin.rpc("due_cycles", { p_today: nyDate() });

  const results: SettlementResult[] = [];

  // One at a time. These run in the background and there is never a queue of
  // them, so there is nothing to gain from doing them at once.
  if (!error && Array.isArray(due)) {
    for (const row of due as WeeklyCycleRow[]) {
      results.push(await settleCycle(row));
    }
  }

  /*
    Then the pods that week finished, and then any season those weeks
    completed. In that order, and both after the weeks themselves: a pod
    ranks on a scored portfolio, and the database refuses to close a season
    with an unsettled week inside it.
  */
  await settleDuePods();
  await closeDueSeasons();

  return results;
}

/**
 * Closes every season whose quarter has ended and whose weeks are all scored.
 *
 * Ranks nothing itself and grants nothing itself: it hands a season id to the
 * database, which does both in one transaction. A season half-ranked because
 * a request was cut off would be worse than one ranked late.
 */
export async function closeDueSeasons(): Promise<string[]> {
  if (!canWriteGame) return [];

  const admin = createAdminClient();

  const { data: due, error } = await admin.rpc("due_seasons", { p_today: nyDate() });
  if (error || !Array.isArray(due) || due.length === 0) return [];

  const closed: string[] = [];

  for (const season of due as SeasonRow[]) {
    const { error: closeError } = await admin.rpc("close_season", {
      p_season_id: season.id,
    });
    // A season that would not close is left open for the next attempt. There
    // is nothing to undo: closing is idempotent and does not part-apply.
    if (!closeError) closed.push(season.name);
  }

  return closed;
}

async function settleCycle(input: WeeklyCycleRow): Promise<SettlementResult> {
  // Reassigned below when a missing opening price is filled in, which is the
  // one thing about a cycle this function can still learn.
  let cycle = input;

  const admin = createAdminClient();
  const base = { cycleId: cycle.id, monday: cycle.monday };

  const { data: claimed } = await admin.rpc("claim_cycle_for_scoring", {
    p_cycle_id: cycle.id,
    p_stale_after: STALE_CLAIM,
  });

  // Somebody else got there first, which is the normal case under load.
  if (!claimed) return { ...base, status: "claimed-elsewhere" };

  try {
    const lastDay = cycle.ends_on ?? cycleFriday(cycle.monday);

    /*
      What it was measured from, if that was never learned.

      A battle started at the weekend has no opening price at the moment it is
      created, and the screen fills it in on the first visit once the market
      has opened. A battle nobody opened until it was over never got that
      visit, so this is the last chance to ask -- and the chart request works
      as well for a Monday three months ago as for this one.

      Without it the settle would raise "no benchmark open", release the claim
      and try again forever, which is the shape of failure this file exists to
      avoid.
    */
    if (cycle.benchmark_open == null) {
      const open = await getSessionOpen(cycle.benchmark_symbol, cycle.monday);
      if (open != null) {
        const { data: updated } = await admin.rpc("set_benchmark_open", {
          p_cycle_id: cycle.id,
          p_open: open,
        });
        if (updated) cycle = updated as unknown as WeeklyCycleRow;
      }
    }

    if (cycle.benchmark_open == null) {
      await admin.rpc("release_cycle_claim", { p_cycle_id: cycle.id });
      return {
        ...base,
        status: "no-prices",
        detail: `no opening price for ${cycle.benchmark_symbol} on ${cycle.monday}`,
      };
    }

    const { data: holdings } = await admin
      .from("holdings")
      .select("symbol, portfolios!inner(cycle_id)")
      .eq("portfolios.cycle_id", cycle.id);

    const symbols = [
      ...new Set(((holdings ?? []) as { symbol: string }[]).map((h) => h.symbol)),
    ];

    const prices = await getClosingPrices(
      [...symbols, cycle.benchmark_symbol],
      lastDay
    );

    const benchmarkClose = prices[cycle.benchmark_symbol];

    /*
      Without the benchmark there is nothing to measure the week against, so
      the week is put back rather than scored against a guess. A week scored
      wrongly is far worse than a week scored late: the number is shown to
      people as a result, and correcting it afterwards costs their trust.
    */
    if (benchmarkClose == null) {
      await admin.rpc("release_cycle_claim", { p_cycle_id: cycle.id });
      return {
        ...base,
        status: "no-prices",
        detail: `no closing price for ${cycle.benchmark_symbol} on ${lastDay}`,
      };
    }

    const missing = symbols.filter((s) => prices[s] == null);
    if (missing.length > 0) {
      await admin.rpc("release_cycle_claim", { p_cycle_id: cycle.id });
      return {
        ...base,
        status: "no-prices",
        detail: `no closing price for ${missing.join(", ")} on ${lastDay}`,
      };
    }

    const { data: scored, error: scoreError } = await admin.rpc("score_cycle", {
      p_cycle_id: cycle.id,
      p_closing_prices: prices,
      p_benchmark_close: benchmarkClose,
    });

    if (scoreError) {
      await admin.rpc("release_cycle_claim", { p_cycle_id: cycle.id });
      return { ...base, status: "failed", detail: scoreError.message };
    }

    return { ...base, status: "settled", portfolios: num(scored) ?? 0 };
  } catch (error) {
    await admin.rpc("release_cycle_claim", { p_cycle_id: cycle.id });
    return {
      ...base,
      status: "failed",
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }
}

/*
  Whether a due week exists, as one cheap indexed query.

  Called on page renders, so it must stay far cheaper than the settlement it
  might trigger.
*/
export async function hasDueCycle(): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();
  const { data } = await admin.rpc("due_cycles", { p_today: nyDate() });
  return Array.isArray(data) && data.length > 0;
}
