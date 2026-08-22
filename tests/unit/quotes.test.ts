import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  The quote layer, which is the one place a wrong answer becomes a wrong
  number on a scoreboard.

  These tests exist because fetching was changed from one request per symbol
  to one request per batch. That is a real change to how prices reach a
  portfolio, so the properties the old code had -- shared fetches, a stale
  price rather than a missing one, one bad symbol not taking the rest down --
  are pinned here rather than assumed to have survived.
*/

const quote = vi.fn();

vi.mock("yahoo-finance2", () => ({
  default: class {
    quote = quote;
  },
}));

const { getQuotes, __resetQuoteCache } = await import("@/lib/market/quotes");

function raw(symbol: string, price: number) {
  return {
    symbol,
    regularMarketPrice: price,
    regularMarketPreviousClose: price - 1,
    marketState: "REGULAR",
    currency: "USD",
    shortName: symbol,
    quoteType: "EQUITY",
  };
}

/** The batched call returns an object keyed by symbol. */
function batch(prices: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(prices).map(([symbol, price]) => [symbol, raw(symbol, price)])
  );
}

beforeEach(() => {
  __resetQuoteCache();
  quote.mockReset();
});

describe("getQuotes", () => {
  it("prices a whole portfolio in one request", async () => {
    quote.mockResolvedValue(batch({ AAPL: 100, MSFT: 200, SPY: 300 }));

    const quotes = await getQuotes(["AAPL", "MSFT", "SPY"]);

    expect(quote).toHaveBeenCalledTimes(1);
    expect(quote.mock.calls[0][0]).toEqual(["AAPL", "MSFT", "SPY"]);
    expect(quotes.AAPL.price).toBe(100);
    expect(quotes.MSFT.price).toBe(200);
    expect(quotes.SPY.price).toBe(300);
  });

  it("uppercases and de-duplicates before asking", async () => {
    quote.mockResolvedValue(batch({ AAPL: 100, MSFT: 200 }));

    await getQuotes(["aapl", "AAPL", " msft ", ""]);

    expect(quote).toHaveBeenCalledTimes(1);
    expect(quote.mock.calls[0][0]).toEqual(["AAPL", "MSFT"]);
  });

  it("asks once for a single symbol, not as a list", async () => {
    quote.mockResolvedValue(raw("AAPL", 100));

    const quotes = await getQuotes(["AAPL"]);

    expect(quote.mock.calls[0][0]).toBe("AAPL");
    expect(quotes.AAPL.price).toBe(100);
  });

  it("serves a fresh cache entry without going out again", async () => {
    quote.mockResolvedValue(batch({ AAPL: 100, MSFT: 200 }));
    await getQuotes(["AAPL", "MSFT"]);

    quote.mockClear();
    const quotes = await getQuotes(["AAPL", "MSFT"]);

    expect(quote).not.toHaveBeenCalled();
    expect(quotes.AAPL.price).toBe(100);
  });

  it("only asks for the symbols it does not already hold", async () => {
    quote.mockResolvedValue(batch({ AAPL: 100, MSFT: 200 }));
    await getQuotes(["AAPL", "MSFT"]);

    quote.mockClear();
    quote.mockResolvedValue(raw("TSLA", 50));
    await getQuotes(["AAPL", "MSFT", "TSLA"]);

    expect(quote).toHaveBeenCalledTimes(1);
    expect(quote.mock.calls[0][0]).toBe("TSLA");
  });

  it("shares one fetch between callers arriving together", async () => {
    let release: (value: unknown) => void = () => {};
    quote.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const both = Promise.all([
      getQuotes(["AAPL", "MSFT"]),
      getQuotes(["AAPL", "MSFT"]),
    ]);

    release(batch({ AAPL: 100, MSFT: 200 }));
    const [first, second] = await both;

    expect(quote).toHaveBeenCalledTimes(1);
    expect(first.AAPL.price).toBe(100);
    expect(second.AAPL.price).toBe(100);
  });

  it("falls back to one at a time when the batch fails as a whole", async () => {
    quote.mockImplementation(async (query: string | string[]) => {
      if (Array.isArray(query)) throw new Error("batch refused");
      if (query === "BAD") throw new Error("no such symbol");
      return raw(query, 100);
    });

    const quotes = await getQuotes(["AAPL", "BAD"]);

    // One batch attempt, then one request per symbol.
    expect(quote).toHaveBeenCalledTimes(3);
    expect(quotes.AAPL.price).toBe(100);
    expect(quotes.BAD).toBeUndefined();
  });

  it("leaves out a symbol the batch had nothing for, and keeps the rest", async () => {
    quote.mockResolvedValue(batch({ AAPL: 100 }));

    const quotes = await getQuotes(["AAPL", "NOPE"]);

    expect(quotes.AAPL.price).toBe(100);
    expect(quotes.NOPE).toBeUndefined();
  });

  it("refuses an instrument this game does not trade", async () => {
    quote.mockResolvedValue({
      AAPL: raw("AAPL", 100),
      EURUSD: { ...raw("EURUSD", 1.1), quoteType: "CURRENCY" },
    });

    const quotes = await getQuotes(["AAPL", "EURUSD"]);

    expect(quotes.AAPL.price).toBe(100);
    expect(quotes.EURUSD).toBeUndefined();
  });

  it("serves the last known price, marked stale, when a refresh fails", async () => {
    quote.mockResolvedValue(batch({ AAPL: 100, MSFT: 200 }));
    await getQuotes(["AAPL", "MSFT"]);

    // Move past the cache lifetime, then break the provider entirely.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 120_000);
    quote.mockRejectedValue(new Error("provider down"));

    const quotes = await getQuotes(["AAPL", "MSFT"]);

    expect(quotes.AAPL.price).toBe(100);
    expect(quotes.AAPL.stale).toBe(true);
    expect(quotes.MSFT.stale).toBe(true);
    vi.useRealTimers();
  });
});
