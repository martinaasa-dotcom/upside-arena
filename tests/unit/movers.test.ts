import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  What moved today.

  This is the one panel in the app that points at a company by name, so the
  rules about what it may and may not do are worth pinning. It shows real
  moves or it shows nothing; it never pads a quiet day; and it never dresses
  up a rank as anything but the size of a number.
*/

const quote = vi.fn();

vi.mock("yahoo-finance2", () => ({
  default: class {
    quote = quote;
  },
}));

const { getMovers, MOVERS_WATCHLIST } = await import("@/lib/market/movers");
const { __resetQuoteCache } = await import("@/lib/market/quotes");

/** A quote whose change works out to the percentage asked for. */
function raw(symbol: string, changePercent: number) {
  const previousClose = 100;
  return {
    symbol,
    regularMarketPrice: previousClose * (1 + changePercent / 100),
    regularMarketPreviousClose: previousClose,
    marketState: "REGULAR",
    currency: "USD",
    shortName: `${symbol} Inc.`,
    quoteType: "EQUITY",
  };
}

/**
 * Answers the batch with a move for each symbol, spread far enough apart that
 * the ordering is unambiguous: the first name given moves most.
 */
function movingBy(moves: Record<string, number>) {
  quote.mockImplementation(async (symbols: string | string[]) => {
    const list = Array.isArray(symbols) ? symbols : [symbols];
    const out: Record<string, unknown> = {};
    for (const symbol of list) out[symbol] = raw(symbol, moves[symbol] ?? 0);
    return Array.isArray(symbols) ? out : out[list[0]];
  });
}

/** Every watchlist name moving by a different amount, biggest first. */
function laddered(extra: Record<string, number> = {}) {
  const moves: Record<string, number> = { ...extra };
  MOVERS_WATCHLIST.forEach((symbol, index) => {
    if (moves[symbol] == null) {
      // Half up, half down, and no two the same.
      moves[symbol] = index % 2 === 0 ? 10 - index * 0.1 : -(10 - index * 0.1);
    }
  });
  return moves;
}

beforeEach(() => {
  __resetQuoteCache();
  quote.mockReset();
});

describe("the watchlist", () => {
  it("is a real list of recognisable names, not an empty one", () => {
    expect(MOVERS_WATCHLIST.length).toBeGreaterThan(20);
    expect(new Set(MOVERS_WATCHLIST).size).toBe(MOVERS_WATCHLIST.length);
    for (const symbol of MOVERS_WATCHLIST) {
      expect(symbol).toMatch(/^[A-Z0-9.\-]{1,12}$/);
    }
  });
});

describe("what moved", () => {
  it("puts the biggest riser first and the biggest faller first", async () => {
    movingBy(laddered());

    const movers = await getMovers();
    expect(movers).not.toBeNull();
    if (!movers) return;

    const ups = movers.up.map((row) => row.changePercent);
    expect([...ups].sort((a, b) => b - a)).toEqual(ups);
    expect(ups.every((value) => value > 0)).toBe(true);

    const downs = movers.down.map((row) => row.changePercent);
    expect([...downs].sort((a, b) => a - b)).toEqual(downs);
    expect(downs.every((value) => value < 0)).toBe(true);
  });

  /*
    A move of nothing is not a move. Without this a flat day fills both
    columns with names that did not do anything, which reads as four companies
    somebody is being pointed at for no reason.
  */
  it("shows nothing at all on a day when nothing moved", async () => {
    movingBy({});
    expect(await getMovers()).toBeNull();
  });

  /*
    Percentages are shown to one decimal place, so a company up 0.04 per cent
    would be given a colour, a border and a third of a row to say "+0.0%".
  */
  it("leaves out a move too small to be written down", async () => {
    const tiny: Record<string, number> = {};
    MOVERS_WATCHLIST.forEach((symbol, index) => {
      tiny[symbol] = index % 2 === 0 ? 0.04 : -0.04;
    });

    movingBy(tiny);
    expect(await getMovers()).toBeNull();
  });

  it("shows nothing rather than padding a row it cannot fill", async () => {
    // Three names moved and the rest of the market was flat. A panel of three
    // is worse than no panel.
    movingBy({ AAPL: 4, MSFT: -3, NVDA: 2 });
    expect(await getMovers()).toBeNull();
  });

  it("marks what the viewer owns, and includes it even off the watchlist", async () => {
    movingBy(laddered({ WEIRDCO: 40 }));

    const movers = await getMovers(["WEIRDCO"]);
    expect(movers).not.toBeNull();
    if (!movers) return;

    const mine = movers.up.find((row) => row.symbol === "WEIRDCO");
    expect(mine, "a holding that moved most is in the list").toBeDefined();
    expect(mine?.owned).toBe(true);
    expect(movers.up.filter((row) => row.symbol !== "WEIRDCO").every((r) => !r.owned)).toBe(true);
  });

  /*
    A stale price is still shown -- a panel that emptied itself every time the
    upstream hiccuped would be worse than one that says its prices are a minute
    behind -- but it has to say so, which is the same rule the portfolio screen
    follows.
  */
  it("says so when a price came from cache after a failed refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T14:00:00Z"));

    try {
      movingBy(laddered());
      const first = await getMovers();
      expect(first?.anyStale).toBe(false);

      // Past the cache's time to live, so the next ask is a real refresh.
      vi.setSystemTime(new Date("2026-08-24T14:05:00Z"));
      quote.mockRejectedValue(new Error("upstream is down"));

      const second = await getMovers();
      expect(second, "the last known prices are still shown").not.toBeNull();
      expect(second?.anyStale, "and are labelled as catching up").toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never returns more than a row each way", async () => {
    movingBy(laddered());

    const movers = await getMovers();
    expect(movers).not.toBeNull();
    if (!movers) return;

    expect(movers.up.length).toBeLessThanOrEqual(4);
    expect(movers.down.length).toBeLessThanOrEqual(4);
  });
});
