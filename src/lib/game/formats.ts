/*
  Formats: the different games you can play with the same market.

  The house game is one week, buy anything, most money at Friday's close wins.
  It is a good game and it is deliberately the default. It is also the only
  game, which is the problem this file exists to solve: five days of "buy
  whatever you like" is the same five days every week, and the thing friends
  actually enjoy arguing about is a constraint. Semiconductors only. One
  company, all week, no changing your mind. Pick the losers instead of the
  winners.

  A format is a rule set, not a scoring system. Every one of them still starts
  everybody with the same money on the same day and still measures the result
  the same way, against a market of its own. What changes is what you are
  allowed to buy and how much of it, which is the part that makes people talk.

  Three properties every rule here has, and they are the reason the list is
  short rather than endless:

    1. It can be checked at the moment somebody tries to break it. A rule that
       can only be judged at the end is a rule somebody finds out about after
       they have already lost to it. That is why there is no "hold at least
       five companies" rule and there is a "no more than a quarter in one
       name" rule instead: the second one produces the first, and it produces
       it as a refused trade on Monday rather than a disqualification on
       Friday.

    2. It is enforceable on the server. Everything in this file is pure so the
       browser can render the same rules it is about to be held to, but the
       browser is never what holds anybody to them. See checkTrade's caller.

    3. It is explicable in one sentence, and that sentence is on the card.

  Pure on purpose: no server-only import, no database, no clock. It is data
  and arithmetic, so the same rule text a player reads is the rule the trade
  is checked against.
*/

/** What kind of thing a format lets you own. */
export type Universe =
  | {
      kind: "types";
      /** Yahoo instrument types, upper case. */
      types: readonly string[];
      /** How to describe the whole of it, in plain words. */
      label: string;
    }
  | {
      kind: "list";
      symbols: readonly string[];
      label: string;
    };

/**
 * Which way round a position is.
 *
 * "long" is the ordinary thing: you pay for shares and you want them to go up.
 *
 * "short" is Arena's, and it is a real short with no leverage and no borrowing
 * fee, which is the only kind this game has any business simulating. Opening
 * one costs the same cash a purchase would, and the position is then worth
 * what you put in plus whatever the price has fallen since. If the price
 * doubles the position is worth nothing and stops there, so the most a name
 * can cost you is what you put into it. A real short has no such floor, and
 * simulating an unbounded loss with pretend money would teach somebody the
 * one lesson about shorting that actually hurts, wrongly.
 */
export type Direction = "long" | "short";

/** When a format's market is open. */
export type TradingHours = "market" | "always";

export type Format = {
  id: FormatId;
  name: string;
  /** One line under the name on a card. */
  tagline: string;
  /** The rule, in the words somebody is held to. */
  rule: string;
  icon: string;
  direction: Direction;
  universe: Universe;
  /** How many different companies may be held at once. Null for no limit. */
  maxPositions: number | null;
  /**
   * The most of the starting money that may go into one name, as a percent.
   *
   * Measured against what everybody started with rather than against what the
   * portfolio is worth now, so the limit does not move as the week goes and
   * cannot be argued about afterwards.
   */
  maxWeightPercent: number | null;
  tradingHours: TradingHours;
  /**
   * What this format is measured against.
   *
   * Not always SPY. A week of semiconductors that beat the whole market but
   * lost to every other chip company was not a good week, and saying it was
   * would be the same fabrication as any other invented number.
   */
  benchmark: string;
};

/*
  The lists.

  Held here as plain arrays rather than fetched, because a format whose
  universe changed underneath a running contest would change what a week meant
  halfway through it. They are checked against nothing: a name that stops
  being quotable simply cannot be bought, which the trade screen says.
*/

const SEMICONDUCTORS = [
  "NVDA", "AMD", "INTC", "TSM", "AVGO", "QCOM", "MU", "AMAT",
  "LRCX", "KLAC", "ADI", "TXN", "NXPI", "MRVL", "ON", "MCHP",
  "SWKS", "QRVO", "ASML", "TER", "ENTG", "WOLF", "ARM", "GFS",
] as const;

const BIG_SEVEN = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
] as const;

const ENERGY = [
  "XOM", "CVX", "COP", "SLB", "EOG", "PSX", "MPC", "VLO",
  "OXY", "HAL", "BKR", "DVN", "FANG", "HES", "WMB", "KMI",
  "NEE", "DUK", "SO", "AEP", "EXC", "XEL", "CEG", "VST",
] as const;

const PHARMA = [
  "LLY", "JNJ", "MRK", "PFE", "ABBV", "BMY", "AMGN", "GILD",
  "VRTX", "REGN", "BIIB", "MRNA", "NVO", "AZN", "GSK", "SNY",
  "ZTS", "CI", "UNH", "CVS", "HUM", "ELV", "MCK", "COR",
] as const;

const BANKS = [
  "JPM", "BAC", "WFC", "C", "GS", "MS", "USB", "PNC",
  "TFC", "SCHW", "BK", "STT", "AXP", "COF", "DFS", "SYF",
  "FITB", "KEY", "RF", "CFG", "HBAN", "MTB", "ALLY", "NTRS",
] as const;

const MEMES = [
  "GME", "AMC", "BB", "PLTR", "SOFI", "HOOD", "RIVN", "LCID",
  "DJT", "MSTR", "COIN", "RIOT", "MARA", "CVNA", "SPCE", "CHWY",
] as const;

const CRYPTO = [
  "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD",
  "AVAX-USD", "DOT-USD", "LINK-USD", "LTC-USD", "MATIC-USD", "ATOM-USD",
] as const;

/** Instrument types the ordinary game accepts: shares and funds, nothing else. */
export const SHARE_TYPES = ["EQUITY", "ETF", "MUTUALFUND", "INDEX"] as const;

export const FORMATS = [
  {
    id: "open" as const,
    name: "Open market",
    tagline: "The house game. Anything you can buy, you can buy.",
    rule: "Any company or fund, as much of it as you like.",
    icon: "\u{1F30D}",
    direction: "long" as const,
    universe: { kind: "types", types: SHARE_TYPES, label: "any company or fund" },
    maxPositions: null,
    maxWeightPercent: null,
    tradingHours: "market" as const,
    benchmark: "SPY",
  },
  {
    id: "silicon" as const,
    name: "Silicon",
    tagline: "Chips, and nothing that is not a chip.",
    rule: "Only the twenty-four semiconductor companies on the list.",
    icon: "\u{1F9E0}",
    direction: "long" as const,
    universe: { kind: "list", symbols: SEMICONDUCTORS, label: "semiconductor companies" },
    maxPositions: null,
    maxWeightPercent: null,
    tradingHours: "market" as const,
    // Beating the whole market with chips in a week chips ran is not a result.
    benchmark: "SOXX",
  },
  {
    id: "inverse" as const,
    name: "Upside down",
    tagline: "Pick the losers. You win when they fall.",
    rule: "Every position is a short. It gains what the price loses, and a name can never cost you more than you put into it.",
    icon: "\u{1F643}",
    direction: "short" as const,
    universe: { kind: "types", types: SHARE_TYPES, label: "any company or fund" },
    maxPositions: null,
    maxWeightPercent: 34,
    tradingHours: "market" as const,
    // The market, upside down, so a falling week is not a free win for everyone.
    benchmark: "SH",
  },
  {
    id: "crypto" as const,
    name: "All hours",
    tagline: "Coins only. This one runs through the weekend.",
    rule: "Only the twelve coins on the list, and the market never shuts, Saturday and Sunday included.",
    icon: "\u{1F311}",
    direction: "long" as const,
    universe: { kind: "list", symbols: CRYPTO, label: "coins" },
    maxPositions: null,
    maxWeightPercent: null,
    tradingHours: "always" as const,
    benchmark: "BTC-USD",
  },
  {
    id: "one_shot" as const,
    name: "One shot",
    tagline: "One company. Pick it and live with it.",
    rule: "One company at a time. You may sell it and choose again, but you can never hold two.",
    icon: "\u{1F3AF}",
    direction: "long" as const,
    universe: { kind: "types", types: SHARE_TYPES, label: "any company or fund" },
    maxPositions: 1,
    maxWeightPercent: null,
    tradingHours: "market" as const,
    benchmark: "SPY",
  },
  {
    id: "big_seven" as const,
    name: "The big seven",
    tagline: "Seven companies. Everyone has the same seven.",
    rule: "Only Apple, Microsoft, Alphabet, Amazon, Nvidia, Meta and Tesla.",
    icon: "\u{1F48E}",
    direction: "long" as const,
    universe: { kind: "list", symbols: BIG_SEVEN, label: "the seven" },
    maxPositions: null,
    maxWeightPercent: null,
    tradingHours: "market" as const,
    benchmark: "QQQ",
  },
  {
    id: "spread" as const,
    name: "Spread",
    tagline: "No single big bet. Four names minimum, by arithmetic.",
    rule: "No more than a quarter of your starting money in any one name.",
    icon: "\u{1F9FA}",
    direction: "long" as const,
    universe: { kind: "types", types: SHARE_TYPES, label: "any company or fund" },
    maxPositions: null,
    maxWeightPercent: 25,
    tradingHours: "market" as const,
    benchmark: "SPY",
  },
  {
    id: "energy" as const,
    name: "Oil and power",
    tagline: "Drillers, refiners and the grid.",
    rule: "Only the twenty-four energy and utility companies on the list.",
    icon: "\u{26A1}",
    direction: "long" as const,
    universe: { kind: "list", symbols: ENERGY, label: "energy and utility companies" },
    maxPositions: null,
    maxWeightPercent: null,
    tradingHours: "market" as const,
    benchmark: "XLE",
  },
  {
    id: "pharma" as const,
    name: "Pills and trials",
    tagline: "Medicine, insurers and the people who make both.",
    rule: "Only the twenty-four health companies on the list.",
    icon: "\u{1F489}",
    direction: "long" as const,
    universe: { kind: "list", symbols: PHARMA, label: "health companies" },
    maxPositions: null,
    maxWeightPercent: null,
    tradingHours: "market" as const,
    benchmark: "XLV",
  },
  {
    id: "banks" as const,
    name: "The banks",
    tagline: "Lenders, brokers and card companies.",
    rule: "Only the twenty-four financial companies on the list.",
    icon: "\u{1F3E6}",
    direction: "long" as const,
    universe: { kind: "list", symbols: BANKS, label: "financial companies" },
    maxPositions: null,
    maxWeightPercent: null,
    tradingHours: "market" as const,
    benchmark: "XLF",
  },
  {
    id: "meme" as const,
    name: "The loud ones",
    tagline: "Sixteen companies the internet will not stop talking about.",
    rule: "Only the sixteen on the list, and no more than a third in any one of them.",
    icon: "\u{1F4A5}",
    direction: "long" as const,
    universe: { kind: "list", symbols: MEMES, label: "the loud sixteen" },
    maxPositions: null,
    // These move far enough that one name unchecked is the whole result.
    maxWeightPercent: 34,
    tradingHours: "market" as const,
    benchmark: "SPY",
  },
  {
    id: "index" as const,
    name: "Funds only",
    tagline: "No stock picking. The slow one, and it wins more than you think.",
    rule: "Only funds. No individual companies.",
    icon: "\u{1F4CA}",
    direction: "long" as const,
    universe: { kind: "types", types: ["ETF", "MUTUALFUND"], label: "funds" },
    maxPositions: null,
    maxWeightPercent: null,
    tradingHours: "market" as const,
    benchmark: "SPY",
  },
] as const;

export type FormatId = (typeof FORMATS)[number]["id"];

/** The house game, and what a cycle with no format recorded means. */
export const DEFAULT_FORMAT: FormatId = "open";

export const FORMAT_IDS = FORMATS.map((format) => format.id);

export function isFormatId(value: string): value is FormatId {
  return (FORMAT_IDS as string[]).includes(value);
}

/**
 * A format by id, falling back to the house game.
 *
 * Never throws. A cycle recorded with a format this build has since dropped
 * still has to be readable, and showing it as the ordinary game is a much
 * smaller wrong than a screen that will not render.
 */
export function formatById(id: string | null | undefined): Format {
  const found = FORMATS.find((format) => format.id === id);
  return (found ?? FORMATS[0]) as Format;
}

/** Every symbol a list format allows, for a picker rather than a search box. */
export function allowedSymbols(format: Format): readonly string[] | null {
  return format.universe.kind === "list" ? format.universe.symbols : null;
}

export function allowsSymbol(format: Format, symbol: string, quoteType?: string | null) {
  if (format.universe.kind === "list") {
    return format.universe.symbols.includes(symbol.toUpperCase());
  }

  // With no type known the name is allowed here and refused by the quote layer
  // if it turns out to be something this game does not price.
  if (!quoteType) return true;
  return format.universe.types.includes(quoteType.toUpperCase());
}

/*
  What a position is worth right now.

  The only place the two directions differ, and the reason it is one function
  rather than an `if` at each of the six call sites that need it.

  Long is the obvious thing: shares times price.

  Short is what you put in, plus what the price has fallen since you put it in.
  Written as `2 * cost - shares * price` it is the same arithmetic and much
  harder to read, so it is written the long way here and the short way in SQL,
  where the comment says so.
*/
export function positionValue(
  format: Pick<Format, "direction">,
  input: { quantity: number; costBasis: number; price: number | null }
): number {
  const { quantity, costBasis, price } = input;

  // No price at all: worth what it cost. Zero would look like a wipeout that
  // never happened.
  if (price == null || !Number.isFinite(price)) return costBasis;

  if (format.direction === "long") return quantity * price;

  const entry = quantity > 0 ? costBasis / quantity : 0;
  return Math.max(costBasis + (entry - price) * quantity, 0);
}

export type HeldPosition = {
  symbol: string;
  quantity: number;
  costBasis: number;
};

export type TradeCheck =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Whether the rules of a format allow a trade.
 *
 * Called on the server before anything is written, and called again in the
 * browser only so a button can be disabled with the reason next to it. The
 * second call is a courtesy; the first is the rule.
 *
 * Money is checked elsewhere. This answers "does this format permit it",
 * not "can they afford it", because those are two different sentences to be
 * told and mixing them produces the worst one.
 */
export function checkTrade(
  format: Format,
  input: {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    startingBalance: number;
    positions: readonly HeldPosition[];
    quoteType?: string | null;
  }
): TradeCheck {
  const symbol = input.symbol.toUpperCase();

  // Selling is always allowed. A rule that can trap somebody in a position is
  // a rule that turns a game into a punishment.
  if (input.side === "sell") return { ok: true };

  if (!allowsSymbol(format, symbol, input.quoteType)) {
    return {
      ok: false,
      error:
        format.universe.kind === "list"
          ? `${format.name} is ${format.universe.label} only, and ${symbol} is not one of them.`
          : `${format.name} is ${format.universe.label} only, and ${symbol} is not one.`,
    };
  }

  const existing = input.positions.find((p) => p.symbol.toUpperCase() === symbol);

  if (format.maxPositions != null && !existing) {
    const held = input.positions.filter((p) => p.quantity > 0).length;
    if (held >= format.maxPositions) {
      return {
        ok: false,
        error:
          format.maxPositions === 1
            ? `${format.name} is one company at a time. Sell what you are holding first.`
            : `${format.name} allows ${format.maxPositions} companies at once. Sell one first.`,
      };
    }
  }

  if (format.maxWeightPercent != null && input.startingBalance > 0) {
    const cap = (format.maxWeightPercent / 100) * input.startingBalance;
    const after = (existing?.costBasis ?? 0) + input.quantity * input.price;

    // A cent of rounding must not refuse a trade that is exactly at the cap.
    if (after > cap + 0.005) {
      return {
        ok: false,
        error: `${format.name} caps one name at ${format.maxWeightPercent}% of what you started with. That order would put you over.`,
      };
    }
  }

  return { ok: true };
}
