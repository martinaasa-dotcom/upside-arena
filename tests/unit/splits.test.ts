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
const { splitsInWindow } = await import("@/lib/game/splits");

beforeEach(() => {
  chart.mockReset();
});

function split(symbol: string, effectiveOn: string, numerator = 10, denominator = 1) {
  return { symbol, effectiveOn, numerator, denominator };
}

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

    const [event] = await getSplits("SIRI", "2024-09-01", "2024-09-20");
    expect(event.numerator).toBe(1);
    expect(event.denominator).toBe(10);
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

  it("comes back empty when the provider does, rather than throwing into a page", async () => {
    chart.mockRejectedValue(new Error("provider down"));
    expect(await getSplits("AAPL", "2026-06-01", "2026-06-10")).toEqual([]);
  });
});
