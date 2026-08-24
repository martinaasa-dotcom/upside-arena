import "server-only";

import { cacheLife } from "next/cache";
import { QUOTE_TTL_SECONDS } from "@/lib/game";
import { sessionMark } from "@/lib/market/session";
import { getYahoo } from "@/lib/market/yahoo";

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
  /*
    What Yahoo says this is: EQUITY, ETF, CRYPTOCURRENCY and so on.

    Carried because a format decides what may be owned by kind rather than by
    name -- "funds only", "coins only" -- and the check has to happen against
    what the thing actually is, not against what somebody typed.
  */
  type: string | null;
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
  exchange?: string | null;
};

/*
  What this game will price at all.

  Options, futures and currency pairs are still out: they settle differently,
  they are leveraged, and letting one in would quietly change what a week
  measures.

  Coins are in, and only because a format asks for them. This is the widest
  the door goes; which of these a given contest actually allows is a rule of
  the format, in src/lib/game/formats.ts, and the house week still allows
  shares and funds only. Pricing something is not permission to buy it.
*/
const PRICEABLE_TYPES = new Set([
  "EQUITY",
  "ETF",
  "MUTUALFUND",
  "INDEX",
  "CRYPTOCURRENCY",
]);

/**
 * The money the game is played in.
 *
 * Everything about Arena is dollars: the hundred thousand everybody starts
 * with, the benchmark, the market hours, every figure on every screen. Yahoo
 * will happily quote a company from any exchange on earth in whatever it
 * trades in, and until this existed a search for BMW offered BMW.DE, whose
 * price is in euros. Buying it spent dollars at a euro price and valued the
 * position in euros as though they were dollars, which is not a rounding
 * error: it is a portfolio whose number means nothing, ranked against
 * portfolios whose numbers mean something.
 *
 * Converting instead was considered and is the wrong trade. It would put a
 * second moving number under every result, so a week could be won on the
 * dollar rather than on the company, and it needs a rate feed nobody is
 * asking for. The game is the American market. This is that sentence, in
 * code.
 */
const TRADING_CURRENCY = "USD";

/**
 * Where a name has to be listed for this game to price it.
 *
 * A blocklist of the over-the-counter venues rather than a list of the ones
 * that are allowed, so a legitimate venue nobody thought of still works. The
 * OTC market has no listing standards: no minimum price, no reporting
 * requirement, no exchange asking questions. It is where the shells are, it
 * is thin enough that one buyer moves it, and it is where a leaderboard goes
 * to die. HCMC, quoted at $0.0001 the day this was written, is one tick from
 * doubling and would have been findable from the trade screen.
 *
 * OTCQX is in the blocklist too, which loses a handful of respectable foreign
 * ADRs. They are a smaller loss than a tier-by-tier rule nobody can hold in
 * their head, and every company worth owning in a week of American shares is
 * listed on an American exchange.
 */
const OTC_EXCHANGES = new Set(["PNK", "OQX", "OQB", "OTC", "OTCBB", "PK"]);

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
    type: raw.quoteType ?? null,
    fetchedAt: Date.now(),
    stale: false,
  };
}

function accept(raw: YahooQuote | null | undefined, symbol: string): Quote | null {
  if (!raw) return null;
  if (raw.quoteType && !PRICEABLE_TYPES.has(raw.quoteType.toUpperCase())) return null;
  if (raw.currency && raw.currency.toUpperCase() !== TRADING_CURRENCY) return null;
  if (raw.exchange && OTC_EXCHANGES.has(raw.exchange.toUpperCase())) return null;
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

/*
  One batch, cached where every instance can see it.

  Remote, not the plain in-memory kind, because `use cache` keeps entries in
  the instance's own memory, which on a serverless platform is not shared
  between instances and is thrown away after serving a request. On a quiet app
  that means very nearly every read is a miss, and a miss here is a live round
  trip to a rate-limited service that answers with the same number for every
  player in the game. That is what remote caching is for.

  Written honestly, because this arrived as a wrong answer to something else.
  Two rooms were slow and three were not, and this was offered as the reason
  on the grounds that the two slow ones were the two that ask for a price. It
  was not the reason -- the reason was a clock read in Home that cost the
  route its shell -- and shipping this changed nothing a player could feel.
  It is kept because it is right on its own terms, not because it fixed that.

  Worth knowing before relying on it: without a remote handler supplied by the
  platform, Next falls back to the ordinary in-memory one and this directive
  does nothing at all. No warning, no error. Whether it is doing anything here
  has not been confirmed.

  The map at the top of this file is the same idea and does not survive: it is
  process memory, and a serverless instance that has just started has none of
  it. Prices are asked for on the way to drawing Home, Trade and Season, so a
  cold instance meant a live round trip to Yahoo standing between a tap and any
  number at all -- and cold instances are the common case on an app with quiet
  stretches.

  Keyed on the symbols rather than split into one entry per symbol, which is
  the difference between keeping the batch below and losing it. A cached
  function per symbol would have turned one request for eight holdings into
  eight, because each cached miss is its own call and knows nothing about its
  neighbours; the way to fix that is to collect misses on a timer, and a
  collector that is ever prevented from firing wedges every later request
  behind a promise that will not resolve. That is a bad trade for a price.

  Sorted, so two players holding the same names in a different order are one
  entry. The benchmark is the case that matters most and is perfect for this:
  it is one symbol, asked for on every single screen by everybody, so it is one
  cache entry for the whole game.

  Stale-while-revalidate at the same minute the in-memory copy used, so a
  minute-old price is served immediately and refreshed behind the reader. It
  was never a live price -- Yahoo is delayed and the game is built on that --
  and a number that arrives is worth more here than a number that is fifteen
  seconds newer and late.
*/
async function sharedQuotes(symbols: string[]): Promise<[string, Quote][]> {
  "use cache: remote";
  cacheLife({
    stale: QUOTE_TTL_SECONDS,
    revalidate: QUOTE_TTL_SECONDS,
    expire: QUOTE_TTL_SECONDS * 10,
  });

  const results = await fetchMany(symbols);
  const found = [...results].filter(([, quote]) => quote != null) as [
    string,
    Quote,
  ][];

  /*
    A refresh that produced nothing at all is a failure, and a failure must
    not be cached: doing so would hold every reader on last known prices for a
    full minute because of one bad moment upstream. Thrown rather than
    returned, because a rejection is the one answer a cache does not keep. The
    caller treats it as the refresh failing, which is what it is.
  */
  if (symbols.length > 0 && found.length === 0) {
    throw new Error("no quotes");
  }

  return found;
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
    // Sorted so the key does not depend on the order holdings came back in.
    const batch = sharedQuotes([...fresh].sort()).catch(
      () => [] as [string, Quote][]
    );

    for (const symbol of fresh) {
      const pending = batch
        .then((entries) => new Map(entries).get(symbol) ?? null)
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

/** Whether this game can put a price on something at all. */
export function isPriceable(quoteType: string | null | undefined): boolean {
  return quoteType ? PRICEABLE_TYPES.has(quoteType.toUpperCase()) : true;
}

/**
 * Symbol search for the trade screen.
 *
 * Restricted to the instrument types the contest being played accepts, so
 * nothing can be found here that cannot then be bought. A format that names
 * its companies one by one does not search at all -- the trade screen offers
 * the list instead, which is both faster and impossible to be refused by.
 */
/**
 * The venues a search may offer, which is the American market and nothing
 * else.
 *
 * An allowlist here, where the quote layer uses a blocklist, and the
 * difference is deliberate. The quote layer answers "can this be priced at
 * all", so an unknown venue should work. This answers "what do we put in
 * front of somebody", and the rule that governs it is that nothing findable
 * here may be refused two clicks later. Yahoo returns nine listings of the
 * same German carmaker before it returns anything an American exchange has
 * ever heard of, and every one of them would have been refused.
 *
 * Nasdaq's three tiers, the NYSE, NYSE American, NYSE Arca, Cboe, the code
 * mutual funds come back under, and the one indices use. Read off real
 * search results rather than guessed at.
 */
const US_EXCHANGES = new Set([
  "NMS", // Nasdaq Global Select
  "NGM", // Nasdaq Global Market
  "NCM", // Nasdaq Capital Market
  "NYQ", // New York Stock Exchange
  "ASE", // NYSE American
  "PCX", // NYSE Arca
  "BTS", // Cboe BZX
  "NAS", // where mutual funds come back
  "SNP", // where the indices do
]);

export async function searchSymbols(
  query: string,
  types: readonly string[] = ["EQUITY", "ETF", "MUTUALFUND", "INDEX"]
): Promise<SymbolMatch[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const allowed = new Set(types.map((type) => type.toUpperCase()));

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
      .filter((q) => q.symbol && allowed.has((q.quoteType ?? "").toUpperCase()))
      .filter((q) => US_EXCHANGES.has((q.exchange ?? "").toUpperCase()))
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
