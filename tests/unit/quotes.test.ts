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
const search = vi.fn();

vi.mock("yahoo-finance2", () => ({
  default: class {
    quote = quote;
    search = search;
  },
}));

const { getQuotes, searchSymbols, __resetQuoteCache } = await import(
  "@/lib/market/quotes"
);

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
  search.mockReset();
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

/*
  What this game is allowed to put a price on, which is a narrower question
  than what Yahoo can price.

  Both of these were findable from the trade screen the day they were written.
  A search for BMW offered BMW.DE at 58.52, which is euros, and Arena would
  have spent dollars at that number and then valued the position as though the
  two were the same money. A search for HCMC offered a stock quoted at
  $0.0001, where one tick is a hundred percent and a week is decided by
  nobody's judgement at all.
*/
describe("the universe the quote layer will price", () => {
  it("refuses a listing quoted in anything but dollars", async () => {
    quote.mockResolvedValue({
      AAPL: raw("AAPL", 100),
      "BMW.DE": { ...raw("BMW.DE", 58.52), currency: "EUR" },
    });

    const quotes = await getQuotes(["AAPL", "BMW.DE"]);

    expect(quotes.AAPL.price).toBe(100);
    expect(quotes["BMW.DE"]).toBeUndefined();
  });

  it("refuses the over-the-counter venues, whatever the price is", async () => {
    quote.mockResolvedValue({
      AAPL: raw("AAPL", 100),
      // Priced well above the floor, and still not something to own here.
      RHHBY: { ...raw("RHHBY", 58.1), exchange: "OQX" },
      HCMC: { ...raw("HCMC", 0.0001), exchange: "PNK" },
    });

    const quotes = await getQuotes(["AAPL", "RHHBY", "HCMC"]);

    expect(quotes.AAPL.price).toBe(100);
    expect(quotes.RHHBY).toBeUndefined();
    expect(quotes.HCMC).toBeUndefined();
  });

  it("keeps every venue an American exchange actually uses", async () => {
    const venues = ["NMS", "NGM", "NCM", "NYQ", "ASE", "PCX", "BTS", "NAS", "SNP", "CCC"];
    quote.mockResolvedValue(
      Object.fromEntries(
        venues.map((venue, i) => [venue, { ...raw(venue, 10 + i), exchange: venue }])
      )
    );

    const quotes = await getQuotes(venues);

    for (const venue of venues) expect(quotes[venue], venue).toBeDefined();
  });
});

describe("what the search box offers", () => {
  function found(rows: Array<{ symbol: string; quoteType: string; exchange: string }>) {
    search.mockResolvedValue({
      quotes: rows.map((row) => ({ ...row, shortname: row.symbol, isYahooFinance: true })),
    });
  }

  it("offers nothing it would then refuse to buy", async () => {
    found([
      { symbol: "BMW.DE", quoteType: "EQUITY", exchange: "GER" },
      { symbol: "APC.F", quoteType: "EQUITY", exchange: "FRA" },
      { symbol: "HCMC", quoteType: "EQUITY", exchange: "PNK" },
      { symbol: "AAPL", quoteType: "EQUITY", exchange: "NMS" },
    ]);

    const matches = await searchSymbols("apple");

    expect(matches.map((m) => m.symbol)).toEqual(["AAPL"]);
  });

  it("still finds funds, which come back under their own venue", async () => {
    found([
      { symbol: "VFIAX", quoteType: "MUTUALFUND", exchange: "NAS" },
      { symbol: "VOO", quoteType: "ETF", exchange: "PCX" },
      { symbol: "SPYY.L", quoteType: "ETF", exchange: "LSE" },
    ]);

    const matches = await searchSymbols("vanguard");

    expect(matches.map((m) => m.symbol)).toEqual(["VFIAX", "VOO"]);
  });
});
