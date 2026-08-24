import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClosingPrices, getSessionOpen } from "@/lib/market/benchmark";
import { hoursSinceContestEnd, nyDate } from "@/lib/market/session";
import { formatById } from "@/lib/game/formats";
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

/**
 * How long a company has to stay unpriceable before a week is settled around
 * it.
 *
 * Six hours after the close, so a week whose companies all price settles on
 * the Friday evening as it always did, and a week held up by one name that
 * cannot be priced still has a result before the players are awake on
 * Saturday.
 *
 * The number is a judgement about two different failures. Below it, a passing
 * outage upstream would be mistaken for a company that has stopped existing,
 * and a position would be settled at cost while the market has it at twice
 * that. Above it, a league sits all weekend with no result and no explanation
 * because one member held a company that was acquired on the Thursday.
 */
const PRICE_GRACE_HOURS = 6;

/**
 * How much of a week may be unpriceable before it is the provider rather than
 * the companies.
 *
 * Delistings arrive one at a time. Half a week's symbols going missing at once
 * is an outage, and settling a week at cost through an outage would be the
 * invented figure this whole file exists to refuse.
 */
const OUTAGE_SHARE = 0.5;

export type UnpricedPlan =
  | { wait: true; reason: string }
  | { wait: false; atCost: string[] };

/**
 * What to do about the companies a week could not price.
 *
 * Pure, and separate from everything that touches the database, because this
 * is the judgement in the whole file most worth being able to test: it decides
 * between a week that ends on a number nobody saw and a week that never ends
 * at all.
 */
export function planForUnpriced(input: {
  missing: readonly string[];
  /** How many of the week's symbols did come back with a price. */
  priced: number;
  hoursSinceEnd: number;
}): UnpricedPlan {
  const { missing, priced, hoursSinceEnd } = input;

  if (missing.length === 0) return { wait: false, atCost: [] };

  const total = missing.length + priced;
  if (total > 0 && missing.length / total >= OUTAGE_SHARE) {
    return {
      wait: true,
      reason: `${missing.length} of ${total} companies have no closing price, which is the provider rather than the companies`,
    };
  }

  if (hoursSinceEnd < PRICE_GRACE_HOURS) {
    return {
      wait: true,
      reason: `no closing price for ${missing.join(", ")} yet, and the week ended too recently to give up on it`,
    };
  }

  return { wait: false, atCost: [...missing] };
}

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

    /*
      The companies that could not be priced, and what to do about them.

      A holding whose company was acquired, delisted, renamed or halted on the
      Thursday has no closing price and never will again. Refusing the whole
      week for it does not protect anybody: it stops every player in that week
      being scored, forever, and from the outside that is indistinguishable
      from a week that has not finished yet.

      So after the grace period, and only while the rest of the week priced
      normally, those names are handed to the database as valued at cost. That
      is not an invented figure: it is what Arena paid for the position, and it
      is what every screen has shown the position as worth for as long as the
      price has been missing.
    */
    const missing = symbols.filter((s) => prices[s] == null);
    const plan = planForUnpriced({
      missing,
      priced: symbols.length - missing.length,
      hoursSinceEnd: hoursSinceContestEnd(
        lastDay,
        formatById(cycle.format).tradingHours === "always"
      ),
    });

    if (plan.wait) {
      await admin.rpc("release_cycle_claim", { p_cycle_id: cycle.id });
      return { ...base, status: "no-prices", detail: `${plan.reason} (${lastDay})` };
    }

    const { data: scored, error: scoreError } = await admin.rpc("score_cycle", {
      p_cycle_id: cycle.id,
      p_closing_prices: prices,
      p_benchmark_close: benchmarkClose,
      p_at_cost: plan.atCost,
    });

    if (scoreError) {
      await admin.rpc("release_cycle_claim", { p_cycle_id: cycle.id });
      return { ...base, status: "failed", detail: scoreError.message };
    }

    return {
      ...base,
      status: "settled",
      portfolios: num(scored) ?? 0,
      detail:
        plan.atCost.length > 0
          ? `${plan.atCost.join(", ")} could not be priced and was counted at what it cost`
          : undefined,
    };
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
