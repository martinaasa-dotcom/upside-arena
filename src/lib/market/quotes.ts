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

async function fetchOne(symbol: string): Promise<Quote | null> {
  try {
    const yahoo = await getYahoo();
    const raw = (await (
      yahoo as { quote: (s: string) => Promise<YahooQuote> }
    ).quote(symbol)) as YahooQuote;

    if (!raw) return null;
    if (raw.quoteType && !ALLOWED_TYPES.has(raw.quoteType)) return null;

    return toQuote(raw, symbol);
  } catch {
    // A single bad symbol must not take down a whole portfolio view.
    return null;
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

  await Promise.all(
    toFetch.map(async (symbol) => {
      let pending = inFlight.get(symbol);
      if (!pending) {
        pending = fetchOne(symbol).finally(() => inFlight.delete(symbol));
        inFlight.set(symbol, pending);
      }

      const quote = await pending;

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
