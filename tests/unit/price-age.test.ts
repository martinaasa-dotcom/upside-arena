import { describe, expect, it } from "vitest";
import { oldestStale } from "@/lib/game/portfolio";
import { formatAge } from "@/lib/format";
import type { Quote } from "@/lib/market/quotes";

function quote(symbol: string, fetchedAt: number, stale: boolean): Quote {
  return {
    symbol,
    price: 100,
    previousClose: 99,
    change: 1,
    changePercent: 1,
    currency: "USD",
    marketState: "REGULAR",
    name: symbol,
    type: "EQUITY",
    fetchedAt,
    stale,
  };
}

const NOW = Date.parse("2026-08-24T14:00:00Z");
const MINUTE = 60_000;

/*
  Home says how far behind its prices are, and only when they are behind.

  The badge this replaced was in the caution colour and read "Prices are
  catching up", which is an alarm about something a player cannot act on. The
  reading is the useful half, so the rule is that it appears for exactly the
  same condition and says exactly how old the number beside it is.
*/
describe("how far behind the prices are", () => {
  it("says nothing at all while every price is current", () => {
    const quotes = {
      AAPL: quote("AAPL", NOW - MINUTE, false),
      SPY: quote("SPY", NOW - 30_000, false),
    };

    expect(oldestStale(quotes)).toBeNull();
  });

  /*
    The ordinary case, and the reason this is not an always-on reading: a
    quote lives sixty seconds, so a screen reporting its age every time
    anybody looked would say the same thing every time.
  */
  it("answers for the worst figure on the screen, not the best", () => {
    const quotes = {
      FRESH: quote("FRESH", NOW - MINUTE, false),
      RECENT: quote("RECENT", NOW - 6 * MINUTE, true),
      WORST: quote("WORST", NOW - 41 * MINUTE, true),
    };

    expect(oldestStale(quotes)).toBe(NOW - 41 * MINUTE);
  });

  /*
    The benchmark is priced through the same map. It is what "The market"
    is measured from, so a comparison drawn against an hour-old print is
    exactly as worth saying as a stale holding.
  */
  it("counts the benchmark, which is not a holding", () => {
    const quotes = { SPY: quote("SPY", NOW - 12 * MINUTE, true) };

    expect(oldestStale(quotes)).toBe(NOW - 12 * MINUTE);
  });

  it("has nothing to report about an empty portfolio", () => {
    expect(oldestStale({})).toBeNull();
  });
});

describe("the reading itself", () => {
  it("never says a gap in the past happened now", () => {
    // Floored at one: "0m ago" describes now while claiming to describe then.
    expect(formatAge(0)).toBe("1m");
    expect(formatAge(59_000)).toBe("1m");
  });

  it("steps up a unit rather than counting minutes forever", () => {
    expect(formatAge(6 * MINUTE)).toBe("6m");
    expect(formatAge(59 * MINUTE)).toBe("59m");
    expect(formatAge(60 * MINUTE)).toBe("1h");
    expect(formatAge(23 * 60 * MINUTE)).toBe("23h");
    expect(formatAge(24 * 60 * MINUTE)).toBe("1d");
  });
});
