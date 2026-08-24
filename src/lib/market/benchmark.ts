import "server-only";

import { cacheLife } from "next/cache";
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

/*
  The one upstream call that every room waits on.

  getCurrentCycle asks for this before it can do anything else, and every
  room asks getCurrentCycle, so this chart request sat at the head of the
  queue for Home, Trade, Leagues and Season alike -- before the cycle row,
  before the portfolio, before a single price. The caches above it are real
  but they are process memory, and a serverless instance that has just been
  started has none of them. In practice a good share of taps paid a live
  round trip to Yahoo before anything else could begin.

  Cached across instances instead, which is what this value deserves more
  than most: it is the same number for every player in the game, and once the
  market has opened on a Monday it never changes again.

  Five minutes, and stale-while-revalidate, so nothing waits. The reason it is
  not longer is the other half of the day: before the market opens there is no
  bar yet and the honest answer is null, and null must not be cached for
  hours. A short life is what lets the same function be right in both halves
  -- it refreshes behind the reader either way, and the reader never blocks on
  either answer.
*/
async function fetchSessionOpen(
  symbol: string,
  isoDate: string
): Promise<number | null> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });

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

export type SplitEvent = {
  symbol: string;
  /** The market open at which the new share count is the real one. */
  effectiveOn: string;
  /** Ten for one is 10 and 1. One for ten, the reverse, is 1 and 10. */
  numerator: number;
  denominator: number;
};

/**
 * The share splits a company has had in a window of days.
 *
 * The same chart endpoint the closing prices come from, asked for its events
 * as well as its bars. Nothing else upstream reports this, and a split that
 * goes unnoticed is a position valued at the wrong number of shares: ten for
 * one leaves a holder apparently down ninety per cent, and a reverse split
 * hands one a week they did not trade for.
 *
 * Not cached. It is asked once a day, by one worker holding the day's claim,
 * and a cached answer here would be a split applied late for no gain.
 *
 * Null when the question could not be asked at all, which is a different
 * answer from an empty list and the caller treats it as one: "nothing split"
 * and "the provider did not answer" look identical from the outside and lead
 * to opposite decisions.
 */
export async function getSplits(
  symbol: string,
  fromIso: string,
  toIso: string
): Promise<SplitEvent[] | null> {
  try {
    const yahoo = await getYahoo();
    const result = (await (
      yahoo as { chart: (s: string, o: Record<string, unknown>) => Promise<unknown> }
    ).chart(symbol, {
      period1: new Date(`${fromIso}T00:00:00Z`),
      // A day past the end, because the window is inclusive and the bar for
      // the last day has to be inside it.
      period2: new Date(new Date(`${toIso}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000),
      interval: "1d",
      events: "split",
    })) as {
      events?: {
        splits?: Array<{ date?: Date; numerator?: number; denominator?: number }>;
      };
    };

    const splits = result.events?.splits ?? [];

    return splits
      .filter(
        (split) =>
          split.date instanceof Date &&
          Number.isFinite(split.numerator) &&
          Number.isFinite(split.denominator) &&
          (split.numerator as number) > 0 &&
          (split.denominator as number) > 0
      )
      .map((split) => ({
        symbol: symbol.toUpperCase(),
        /*
          Yahoo timestamps a split at the opening bell, which is 13:30 UTC in
          summer and 14:30 in winter, so the UTC date and the New York date
          are the same day either way and slicing it is safe here in a way it
          would not be for an evening timestamp.
        */
        effectiveOn: (split.date as Date).toISOString().slice(0, 10),
        numerator: split.numerator as number,
        denominator: split.denominator as number,
      }));
  } catch {
    return null;
  }
}

/** Clears the cache. Tests only. */
export function __resetBenchmarkCache() {
  openCache.clear();
  openInFlight.clear();
  closeCache.clear();
}
