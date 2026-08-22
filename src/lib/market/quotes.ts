import "server-only";

import { QUOTE_TTL_SECONDS } from "@/lib/game";
import { sessionMark } from "@/lib/market/session";

/*
  Delayed quotes, fetched once per symbol and shared by every player.

  The plan is explicit that cost must scale with the number of symbols, not
  with the number of people looking at them, so nothing here is per-user. A
  thousand players holding $AAPL cost exactly one fetch a minute between them.

  Yahoo is the source, through the same library Upside Lab uses, which handles
  the cookie and crumb dance the raw endpoints now require.
*/

export type Quote = {
  symbol: string;
  /** Newest print available. */
  price: number;
  /** The close today's change is measured against. */
  previousClose: number;
  change: number;
  /** Percent, not a fraction. 1.5 means up one and a half percent. */
  changePercent: number;
  currency: string;
  marketState: string | null;
  name: string | null;
  /** Epoch milliseconds when this print was actually fetched. */
  fetchedAt: number;
  /** True when served from cache after a failed refresh. */
  stale: boolean;
};

type CacheEntry = { quote: Quote; fetchedAt: number };

/*
  Process-memory cache. On a single server this is the whole story; across
  several it means each one fetches at most once per symbol per interval,
  which is still bounded by symbols rather than by users.
*/
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 500;

/** Requests in flight, so ten players asking at once cause one fetch. */
const inFlight = new Map<string, Promise<Quote | null>>();

function prune() {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = [...cache.entries()]
    .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)
    .slice(0, cache.size - MAX_CACHE_ENTRIES);
  for (const [key] of oldest) cache.delete(key);
}

function isFresh(entry: CacheEntry, now = Date.now()) {
  return now - entry.fetchedAt < QUOTE_TTL_SECONDS * 1000;
}

export function normaliseSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

let client: unknown = null;

async function getYahoo() {
  if (client) return client as never;
  const { default: YahooFinance } = await import("yahoo-finance2");
  client = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  return client as never;
}

type YahooQuote = {
  symbol?: string;
  regularMarketPrice?: number | null;
  regularMarketPreviousClose?: number | null;
  preMarketPrice?: number | null;
  postMarketPrice?: number | null;
  marketState?: string | null;
  currency?: string | null;
  shortName?: string | null;
  longName?: string | null;
  quoteType?: string | null;
};

/*
  Only ordinary shares and funds. Options, futures and currencies are not part
  of this game, and letting one in would quietly change what the week measures.
*/
const ALLOWED_TYPES = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX"]);

function toQuote(raw: YahooQuote, symbol: string): Quote | null {
  const { price, previousClose } = sessionMark({
    marketState: raw.marketState ?? null,
    regularPrice: raw.regularMarketPrice ?? null,
    postPrice: raw.postMarketPrice ?? null,
    prePrice: raw.preMarketPrice ?? null,
    previousClose: raw.regularMarketPreviousClose ?? null,
  });

  if (!Number.isFinite(price) || price <= 0) return null;

  const base = previousClose > 0 ? previousClose : price;
  const change = price - base;

  return {
    symbol,
    price,
    previousClose: base,
    change,
    changePercent: base > 0 ? (change / base) * 100 : 0,
    currency: raw.currency ?? "USD",
    marketState: raw.marketState ?? null,
    name: raw.longName ?? raw.shortName ?? null,
    fetchedAt: Date.now(),
    stale: false,
  };
}

function accept(raw: YahooQuote | null | undefined, symbol: string): Quote | null {
  if (!raw) return null;
  if (raw.quoteType && !ALLOWED_TYPES.has(raw.quoteType)) return null;
  return toQuote(raw, symbol);
}

async function fetchOne(symbol: string): Promise<Quote | null> {
  try {
    const yahoo = await getYahoo();
    const raw = (await (
      yahoo as { quote: (s: string) => Promise<YahooQuote> }
    ).quote(symbol)) as YahooQuote;

    return accept(raw, symbol);
  } catch {
    // A single bad symbol must not take down a whole portfolio view.
    return null;
  }
}

/*
  Every symbol we still need, in one request.

  Yahoo prices a list as readily as a single name, and a portfolio of eight
  holdings asking eight times paid eight round trips for one screen. The cost
  model the plan asks for -- per symbol, not per user -- is unchanged; this
  only stops the per-symbol cost being a serial network hop.

  A batch that fails as a whole falls back to fetching each symbol on its own,
  so one unquotable name still cannot take the rest of a portfolio down with
  it. That is the property the per-symbol version had and the reason the
  fallback is here rather than an error.
*/
async function fetchMany(symbols: string[]): Promise<Map<string, Quote | null>> {
  const out = new Map<string, Quote | null>();
  if (symbols.length === 0) return out;
  if (symbols.length === 1) {
    out.set(symbols[0], await fetchOne(symbols[0]));
    return out;
  }

  try {
    const yahoo = await getYahoo();
    const raw = (await (
      yahoo as {
        quote: (
          s: string[],
          o: Record<string, unknown>
        ) => Promise<Record<string, YahooQuote>>;
      }
    ).quote(symbols, { return: "object" })) as Record<string, YahooQuote>;

    for (const symbol of symbols) out.set(symbol, accept(raw?.[symbol], symbol));
    return out;
  } catch {
    // The batch failed as a whole. Ask one at a time rather than reporting
    // every symbol dead, which would mark a whole portfolio stale at once.
    const each = await Promise.all(symbols.map((symbol) => fetchOne(symbol)));
    symbols.forEach((symbol, index) => out.set(symbol, each[index]));
    return out;
  }
}

/**
 * Quotes for the given symbols, from cache where fresh.
 *
 * A symbol that cannot be refreshed falls back to its last known price marked
 * stale, rather than disappearing. A holding that vanishes from a portfolio
 * looks like a bug to the person holding it.
 */
export async function getQuotes(
  symbols: string[]
): Promise<Record<string, Quote>> {
  const wanted = [...new Set(symbols.map(normaliseSymbol).filter(Boolean))];
  const out: Record<string, Quote> = {};
  const toFetch: string[] = [];

  for (const symbol of wanted) {
    const entry = cache.get(symbol);
    if (entry && isFresh(entry)) out[symbol] = entry.quote;
    else toFetch.push(symbol);
  }

  /*
    Anything already being fetched is waited on rather than asked for again,
    and everything else goes out together. Ten players arriving at once still
    cause one fetch per symbol, which is what the in-flight map was always
    for; batching only changes how many requests those fetches take.
  */
  const fresh = toFetch.filter((symbol) => !inFlight.has(symbol));

  if (fresh.length > 0) {
    const batch = fetchMany(fresh);
    for (const symbol of fresh) {
      const pending = batch
        .then((results) => results.get(symbol) ?? null)
        .finally(() => inFlight.delete(symbol));
      inFlight.set(symbol, pending);
    }
  }

  await Promise.all(
    toFetch.map(async (symbol) => {
      const quote = await (inFlight.get(symbol) ?? Promise.resolve(null));

      if (quote) {
        cache.set(symbol, { quote, fetchedAt: quote.fetchedAt });
        out[symbol] = quote;
        return;
      }

      // Refresh failed. Serve the last print we have, labelled honestly.
      const stale = cache.get(symbol);
      if (stale) out[symbol] = { ...stale.quote, stale: true };
    })
  );

  prune();
  return out;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const quotes = await getQuotes([symbol]);
  return quotes[normaliseSymbol(symbol)] ?? null;
}

export type SymbolMatch = {
  symbol: string;
  name: string;
  exchange: string | null;
};

/**
 * Symbol search for the trade screen.
 *
 * Restricted to the same instrument types trading accepts, so nothing can be
 * found here that cannot then be bought.
 */
export async function searchSymbols(query: string): Promise<SymbolMatch[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  try {
    const yahoo = await getYahoo();
    const result = (await (
      yahoo as {
        search: (q: string, opts: Record<string, unknown>) => Promise<unknown>;
      }
    ).search(trimmed, { quotesCount: 12, newsCount: 0 })) as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        quoteType?: string;
        exchange?: string;
        isYahooFinance?: boolean;
      }>;
    };

    return (result.quotes ?? [])
      .filter((q) => q.isYahooFinance !== false)
      .filter((q) => q.symbol && ALLOWED_TYPES.has((q.quoteType ?? "").toUpperCase()))
      .slice(0, 8)
      .map((q) => ({
        symbol: normaliseSymbol(q.symbol as string),
        name: q.longname ?? q.shortname ?? (q.symbol as string),
        exchange: q.exchange ?? null,
      }));
  } catch {
    return [];
  }
}

/** Clears the cache. Tests only. */
export function __resetQuoteCache() {
  cache.clear();
  inFlight.clear();
}
