import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  The benchmark's opening price, which every page load waits on.

  getCurrentCycle asks for this week's open before it can do anything else, so
  a process that has just started and is handed several requests at once used
  to send an identical chart request upstream for each of them. These pin the
  sharing that stops that, and the plain caching that was already here.
*/

const chart = vi.fn();

vi.mock("yahoo-finance2", () => ({
  default: class {
    chart = chart;
    quote = vi.fn();
  },
}));

const { getSessionOpen, __resetBenchmarkCache } = await import(
  "@/lib/market/benchmark"
);

/** A week of daily bars starting on the Monday asked for. */
function bars(open: number) {
  return {
    quotes: [
      { date: new Date("2026-08-17T13:30:00Z"), open, close: open + 1 },
      { date: new Date("2026-08-18T13:30:00Z"), open: open + 1, close: open + 2 },
    ],
  };
}

beforeEach(() => {
  __resetBenchmarkCache();
  chart.mockReset();
});

describe("getSessionOpen", () => {
  it("reads the open of the first bar on or after the Monday", async () => {
    chart.mockResolvedValue(bars(500));
    expect(await getSessionOpen("SPY", "2026-08-17")).toBe(500);
  });

  it("never asks twice for a session that has already been read", async () => {
    chart.mockResolvedValue(bars(500));
    await getSessionOpen("SPY", "2026-08-17");

    chart.mockClear();
    expect(await getSessionOpen("SPY", "2026-08-17")).toBe(500);
    expect(chart).not.toHaveBeenCalled();
  });

  it("shares one request between callers arriving together", async () => {
    let release: (value: unknown) => void = () => {};
    chart.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    // What a cold process looks like when several pages render at once.
    const all = Promise.all([
      getSessionOpen("SPY", "2026-08-17"),
      getSessionOpen("SPY", "2026-08-17"),
      getSessionOpen("SPY", "2026-08-17"),
    ]);

    release(bars(500));

    expect(await all).toEqual([500, 500, 500]);
    expect(chart).toHaveBeenCalledTimes(1);
  });

  it("keeps different weeks apart", async () => {
    chart.mockResolvedValueOnce(bars(500)).mockResolvedValueOnce({
      quotes: [{ date: new Date("2026-08-24T13:30:00Z"), open: 510, close: 511 }],
    });

    expect(await getSessionOpen("SPY", "2026-08-17")).toBe(500);
    expect(await getSessionOpen("SPY", "2026-08-24")).toBe(510);
    expect(chart).toHaveBeenCalledTimes(2);
  });

  it("gives no answer rather than a wrong one when the fetch fails", async () => {
    chart.mockRejectedValue(new Error("provider down"));
    expect(await getSessionOpen("SPY", "2026-08-17")).toBeNull();
  });

  it("asks again after a failure rather than remembering it", async () => {
    chart.mockRejectedValueOnce(new Error("provider down"));
    expect(await getSessionOpen("SPY", "2026-08-17")).toBeNull();

    chart.mockResolvedValueOnce(bars(500));
    expect(await getSessionOpen("SPY", "2026-08-17")).toBe(500);
  });
});
