/**
 * Household coins a player might actually hold or watch.
 *
 * This is not a crypto app. Yahoo already prices these pairs, and the
 * all-hours format has used them for a while. Search used to drop
 * CRYPTOCURRENCY on purpose, because typing BTC also hits a US-listed
 * Bitcoin fund, and because Yahoo's coin list is a casino. The catalog
 * is the filter: three chips people have heard of, a few more if they
 * type the name, and the Yahoo pair stored so quotes keep working.
 *
 * The house week can hold these, on the same hours as shares. A market
 * that never shuts is still the all-hours contest, not Saturday trading
 * in the ordinary week.
 */

export type Coin = {
  /** Yahoo CRYPTOCURRENCY symbol, what we store. */
  symbol: string;
  /** English name on chips and in the suggestion list. */
  name: string;
  /** BTC on the row. Symbol minus the -USD quote. */
  short: string;
  /** What a person types: BTC, BITCOIN, BTCUSD. Uppercase, no spaces. */
  aliases: readonly string[];
};

function coin(
  symbol: string,
  name: string,
  extraAliases: readonly string[] = []
): Coin {
  const short = symbol.replace(/-USD$/, "");
  const aliases = [
    short,
    name.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    `${short}USD`,
    symbol,
    ...extraAliases,
  ];
  return {
    symbol,
    name,
    short,
    aliases: [...new Set(aliases)],
  };
}

/**
 * Bitcoin, Ethereum, Solana on the chips. The rest only appear when
 * someone types the name. No stables, no coins whose Yahoo price sits
 * under the quote layer's sanity floor (SHIB, PEPE).
 */
export const COINS: readonly Coin[] = [
  coin("BTC-USD", "Bitcoin", ["XBT"]),
  coin("ETH-USD", "Ethereum", ["ETHER"]),
  coin("SOL-USD", "Solana"),
  coin("XRP-USD", "XRP", ["RIPPLE"]),
  coin("BNB-USD", "BNB", ["BINANCE"]),
  coin("DOGE-USD", "Dogecoin"),
  coin("ADA-USD", "Cardano"),
  coin("AVAX-USD", "Avalanche"),
  coin("LINK-USD", "Chainlink"),
  coin("TON-USD", "Toncoin"),
  coin("SUI-USD", "Sui"),
  coin("LTC-USD", "Litecoin"),
];

export const HOUSEHOLD_COINS: readonly Coin[] = COINS.slice(0, 3);

const BY_SYMBOL = new Map(COINS.map((c) => [c.symbol, c]));

function queryKey(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^[€$£]+/, "")
    .replace(/\s+/g, "");
}

export function coinFromSymbol(ticker: string): Coin | null {
  const t = ticker.trim().toUpperCase();
  return BY_SYMBOL.get(t) ?? null;
}

export function isCoinSymbol(ticker: string): boolean {
  return coinFromSymbol(ticker) != null;
}

/** A Yahoo coin pair, including names on the all-hours list that are not household. */
export function isCoinPair(ticker: string): boolean {
  return /-[A-Z]{3}$/.test(ticker.trim().toUpperCase());
}

/** Exact name, alias, or stored symbol. Prefix matching is search-only. */
export function matchCoinQuery(raw: string): Coin | null {
  const key = queryKey(raw);
  if (!key) return null;
  const named = COINS.find((c) => c.name.toUpperCase() === key);
  if (named) return named;
  return COINS.find((c) => c.aliases.includes(key)) ?? null;
}

export type CoinSuggestion = { symbol: string; name: string };

/** Typeahead hits, including prefixes ("bit" → Bitcoin). */
export function coinSuggestions(
  query: string,
  exclude: ReadonlySet<string> = new Set()
): CoinSuggestion[] {
  const q = query.trim();
  if (!q) return [];
  const key = queryKey(q);
  const lower = q.toLowerCase();
  if (!key) return [];
  const out: CoinSuggestion[] = [];
  for (const c of COINS) {
    if (exclude.has(c.symbol)) continue;
    const aliasHit = c.aliases.some(
      (a) => a === key || (key.length >= 2 && a.startsWith(key))
    );
    const nameHit =
      c.name.toLowerCase() === lower ||
      (lower.length >= 2 && c.name.toLowerCase().startsWith(lower));
    if (!aliasHit && !nameHit) continue;
    out.push({ symbol: c.symbol, name: c.name });
  }
  return out;
}

/**
 * What a row says instead of the Yahoo pair. BTC-USD is a storage key,
 * not a name a person uses.
 */
export function displaySymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  return coinFromSymbol(t)?.short ?? t.replace(/-USD$/, "");
}

/** "share" / "shares", or "coin" / "coins" for a Yahoo pair. */
export function holdingUnit(ticker: string, quantity: number): string {
  const noun = isCoinPair(ticker) ? "coin" : "share";
  return quantity === 1 ? noun : `${noun}s`;
}

/**
 * Whether a search for this contest should offer the catalog.
 *
 * Equity weeks are the ordinary market. Cryptocurrency weeks are the
 * all-hours contest if it ever searches rather than offering the list.
 * Funds-only does not.
 */
export function searchWantsCoins(types: Iterable<string>): boolean {
  for (const type of types) {
    const upper = type.toUpperCase();
    if (upper === "EQUITY" || upper === "CRYPTOCURRENCY") return true;
  }
  return false;
}
