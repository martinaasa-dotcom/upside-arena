import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Reading a split off the provider, and deciding which ones this morning is
  responsible for.

  The window is the part worth pinning. Too narrow and a split that happened
  while nobody opened the app is never applied, which leaves a position at the
  wrong number of shares until somebody notices by hand. Too wide and a check
  reaches back into weeks that are already scored.
*/

const chart = vi.fn();

vi.mock("yahoo-finance2", () => ({
  default: class {
    chart = chart;
  },
}));

const { getSplits } = await import("@/lib/market/benchmark");
const { isRealSplitRatio, splitsInWindow } = await import("@/lib/game/splits");

beforeEach(() => {
  chart.mockReset();
});

function split(symbol: string, effectiveOn: string, numerator = 10, denominator = 1) {
  return { symbol, effectiveOn, numerator, denominator };
}

describe("a spinoff is not a split", () => {
  /*
    Checked against the live Yahoo feed. GE reports a real 1 for 8 reverse in
    August 2021, then 1281:1000 and 1253:1000, which are the GE HealthCare and
    Vernova spinoffs. A spinoff restates the price history and leaves the share
    count alone, so applying one here would move every lineup holding that
    company and, because this game holds whole shares only, pay the leftover
    fraction out in cash. A leaderboard moved by an event that did not happen.
  */
  const GE_FEED = [
    split("GE", "2021-08-02", 1, 8),
    split("GE", "2023-01-04", 1281, 1000),
    split("GE", "2024-04-02", 1253, 1000),
  ];

  it("knows an adjustment factor from a split", () => {
    expect(isRealSplitRatio(1, 8)).toBe(true);
    expect(isRealSplitRatio(1281, 1000)).toBe(false);
    expect(isRealSplitRatio(1253, 1000)).toBe(false);
  });

  it("never lets one through the window a morning applies from", () => {
    expect(splitsInWindow(GE_FEED, "2023-01-05", 4)).toEqual([]);
    expect(splitsInWindow(GE_FEED, "2024-04-03", 4)).toEqual([]);
    expect(splitsInWindow(GE_FEED, "2021-08-03", 4)).toEqual([GE_FEED[0]]);
  });

  it("takes every ratio a real split is written as", () => {
    for (const [n, d] of [[2, 1], [3, 2], [5, 4], [10, 1], [20, 1], [1, 10], [1, 8]]) {
      expect(isRealSplitRatio(n!, d!)).toBe(true);
    }
  });

  it("reduces the fraction before judging it", () => {
    expect(isRealSplitRatio(20, 10)).toBe(true);
  });

  it("refuses a ratio that is not whole shares, or moves nothing", () => {
    expect(isRealSplitRatio(1.5, 1)).toBe(false);
    expect(isRealSplitRatio(1, 1)).toBe(false);
    expect(isRealSplitRatio(0, 1)).toBe(false);
    expect(isRealSplitRatio(2, 0)).toBe(false);
    expect(isRealSplitRatio(Number.NaN, 1)).toBe(false);
  });
});

describe("which splits a morning is responsible for", () => {
  it("takes the ones that have happened inside the window", () => {
    const events = [split("NVDA", "2026-06-10"), split("AAPL", "2026-06-08")];
    expect(splitsInWindow(events, "2026-06-10", 4).map((s) => s.symbol)).toEqual([
      "NVDA",
      "AAPL",
    ]);
  });

  it("leaves a split that has not happened yet alone", () => {
    // Announced in advance and dated ahead. Applying it early would move
    // somebody's shares before the market did, and pay the fraction at a
    // price that is not the one it will be worth.
    const events = [split("NVDA", "2026-06-15")];
    expect(splitsInWindow(events, "2026-06-10", 4)).toEqual([]);
  });

  it("stops at the edge of the window rather than reaching into scored weeks", () => {
    const events = [split("OLD", "2026-06-05"), split("NEW", "2026-06-06")];
    expect(splitsInWindow(events, "2026-06-10", 4).map((s) => s.symbol)).toEqual(["NEW"]);
  });

  it("looks back far enough to cover a weekend nobody opened the app", () => {
    // Friday's split, found on Tuesday morning. Four days is what makes that
    // the same check rather than a support message.
    const events = [split("FRI", "2026-06-05")];
    expect(splitsInWindow(events, "2026-06-09", 4).map((s) => s.symbol)).toEqual(["FRI"]);
  });
});

describe("reading a split off the provider", () => {
  it("reads the ratio and the day it took effect", async () => {
    // The shape Yahoo really returns, taken from an actual response for the
    // ten for one on 10 June 2024. The timestamp is the opening bell.
    chart.mockResolvedValue({
      events: {
        splits: [
          { date: new Date("2024-06-10T13:30:00.000Z"), numerator: 10, denominator: 1 },
        ],
      },
    });

    expect(await getSplits("NVDA", "2024-06-01", "2024-06-20")).toEqual([
      { symbol: "NVDA", effectiveOn: "2024-06-10", numerator: 10, denominator: 1 },
    ]);
  });

  it("reads a reverse split the same way round", async () => {
    chart.mockResolvedValue({
      events: {
        splits: [
          { date: new Date("2024-09-10T13:30:00.000Z"), numerator: 1, denominator: 10 },
        ],
      },
    });

    const events = await getSplits("SIRI", "2024-09-01", "2024-09-20");
    expect(events?.[0].numerator).toBe(1);
    expect(events?.[0].denominator).toBe(10);
  });

  it("says nothing happened when nothing did", async () => {
    chart.mockResolvedValue({ quotes: [] });
    expect(await getSplits("AAPL", "2026-06-01", "2026-06-10")).toEqual([]);
  });

  it("refuses a ratio that is not a ratio", async () => {
    chart.mockResolvedValue({
      events: { splits: [{ date: new Date("2026-06-10T13:30:00Z"), numerator: 0, denominator: 1 }] },
    });
    expect(await getSplits("ZERO", "2026-06-01", "2026-06-10")).toEqual([]);
  });

  it("says it could not ask, which is not the same as nothing happening", async () => {
    /*
      An empty list means the provider answered and there was no split. Null
      means it did not answer. The caller hands the day's claim back on the
      second and not on the first, so a provider having a bad minute costs an
      hour rather than a day of everybody's shares being wrong.
    */
    chart.mockRejectedValue(new Error("provider down"));
    expect(await getSplits("AAPL", "2026-06-01", "2026-06-10")).toBeNull();
  });
});
