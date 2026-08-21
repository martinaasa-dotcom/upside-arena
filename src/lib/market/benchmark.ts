import "server-only";

import { BENCHMARK_SYMBOL } from "@/lib/game";
import { getQuote } from "@/lib/market/quotes";

/*
  The market's own result for the week, which every player is measured
  against.

  Beating a rising market and beating a falling one are different
  achievements, and a raw percentage cannot tell them apart. Comparing against
  the benchmark is what stops a good week in a bad market reading as failure.
*/

export type BenchmarkWeek = {
  symbol: string;
  /** Where the benchmark opened on Monday. */
  open: number;
  /** Where it is now, or where it closed on Friday. */
  current: number;
  /** Percent move across the week so far. */
  returnPercent: number;
};

type ChartBar = { date: Date; open: number | null; close: number | null };

let client: unknown = null;

async function getYahoo() {
  if (client) return client as never;
  const { default: YahooFinance } = await import("yahoo-finance2");
  client = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  return client as never;
}

const openCache = new Map<string, number>();

/**
 * The opening price on a given New York date.
 *
 * Cached without expiry, because a past session's open never changes. Only
 * the current week's Monday is ever asked for, so the map stays tiny.
 */
export async function getSessionOpen(
  symbol: string,
  isoDate: string
): Promise<number | null> {
  const key = `${symbol}:${isoDate}`;
  const cached = openCache.get(key);
  if (cached != null) return cached;

  try {
    const yahoo = await getYahoo();
    const start = new Date(`${isoDate}T00:00:00Z`);
    const end = new Date(start.getTime() + 8 * 24 * 60 * 60 * 1000);

    const result = (await (
      yahoo as {
        chart: (s: string, o: Record<string, unknown>) => Promise<unknown>;
      }
    ).chart(symbol, {
      period1: start,
      period2: end,
      interval: "1d",
    })) as { quotes?: ChartBar[] };

    const bars = result.quotes ?? [];
    // The first bar at or after the Monday. A holiday Monday shifts this to
    // Tuesday, which is the correct start of that trading week.
    const first = bars.find(
      (bar) => bar.date && bar.date.toISOString().slice(0, 10) >= isoDate
    );

    const open = first?.open ?? first?.close ?? null;
    if (open == null || !Number.isFinite(open) || open <= 0) return null;

    openCache.set(key, open);
    return open;
  } catch {
    return null;
  }
}

/** The benchmark's move from Monday's open to now. */
export async function getBenchmarkWeek(
  mondayIso: string
): Promise<BenchmarkWeek | null> {
  const [open, quote] = await Promise.all([
    getSessionOpen(BENCHMARK_SYMBOL, mondayIso),
    getQuote(BENCHMARK_SYMBOL),
  ]);

  if (open == null || !quote) return null;

  return {
    symbol: BENCHMARK_SYMBOL,
    open,
    current: quote.price,
    returnPercent: ((quote.price - open) / open) * 100,
  };
}

/** Clears the cache. Tests only. */
export function __resetBenchmarkCache() {
  openCache.clear();
}
