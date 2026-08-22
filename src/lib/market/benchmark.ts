import "server-only";

import { BENCHMARK_SYMBOL } from "@/lib/game";
import { getQuote } from "@/lib/market/quotes";
import { getYahoo } from "@/lib/market/yahoo";

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

const openCache = new Map<string, number>();

/*
  Opens being fetched right now, so a cold process asks once.

  Every page load goes through getCurrentCycle, which asks for this week's
  benchmark open before it can do anything else. With only the finished-value
  cache below, a process that has just started and is handed a dozen requests
  at once sent a dozen identical chart requests upstream, because none of them
  had finished in time to populate it for the others. This is the same
  in-flight sharing the quote layer already does, and for the same reason.
*/
const openInFlight = new Map<string, Promise<number | null>>();

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

  const pending = openInFlight.get(key);
  if (pending) return pending;

  const fetching = fetchSessionOpen(symbol, isoDate).finally(() =>
    openInFlight.delete(key)
  );
  openInFlight.set(key, fetching);
  return fetching;
}

async function fetchSessionOpen(
  symbol: string,
  isoDate: string
): Promise<number | null> {
  const key = `${symbol}:${isoDate}`;

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

const closeCache = new Map<string, number>();

/**
 * Closing prices for a finished session.
 *
 * Used to settle a week, so it must land on the price that actually closed
 * that day rather than whatever is current. A market holiday means no bar for
 * the date, in which case the last session at or before it is the right
 * answer: that is what a holding was genuinely worth when the week ended.
 */
export async function getClosingPrices(
  symbols: string[],
  isoDate: string
): Promise<Record<string, number>> {
  const wanted = [...new Set(symbols.map((s) => s.trim().toUpperCase()))].filter(Boolean);
  const out: Record<string, number> = {};

  await Promise.all(
    wanted.map(async (symbol) => {
      const key = `${symbol}:${isoDate}`;
      const cached = closeCache.get(key);
      if (cached != null) {
        out[symbol] = cached;
        return;
      }

      try {
        const yahoo = await getYahoo();
        // A window either side, so a holiday or a thin week still resolves.
        const start = new Date(`${isoDate}T00:00:00Z`);
        const result = (await (
          yahoo as { chart: (s: string, o: Record<string, unknown>) => Promise<unknown> }
        ).chart(symbol, {
          period1: new Date(start.getTime() - 10 * 24 * 60 * 60 * 1000),
          period2: new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000),
          interval: "1d",
        })) as { quotes?: ChartBar[] };

        const bars = (result.quotes ?? []).filter(
          (bar) => bar.date && bar.date.toISOString().slice(0, 10) <= isoDate
        );
        const last = bars.at(-1);
        const close = last?.close ?? last?.open ?? null;

        if (close != null && Number.isFinite(close) && close > 0) {
          closeCache.set(key, close);
          out[symbol] = close;
        }
      } catch {
        // A symbol we cannot price is left out. The caller decides whether
        // that is fatal for the week.
      }
    })
  );

  return out;
}

/** Clears the cache. Tests only. */
export function __resetBenchmarkCache() {
  openCache.clear();
  openInFlight.clear();
  closeCache.clear();
}
