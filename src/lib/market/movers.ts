import "server-only";

import { getQuotes, type Quote } from "@/lib/market/quotes";

/*
  What moved today.

  Home could tell somebody what their money was worth and what the market did,
  and nothing whatever about what had actually happened. Which is the reason
  there was no reason to open it on a Tuesday: the two numbers it had both
  move slowly, and neither of them is news.

  This is news, and it is real news rather than manufactured urgency: today's
  actual moves, in companies whose names a person recognises, plus whatever
  they happen to own. Nothing is ranked by how exciting it is, nothing is
  chosen to make somebody trade, and the copy on the panel says outright that
  a big move is not a reason to buy anything. The plan rules out fake urgency
  as firmly as it rules out fake numbers, and a list of the day's largest real
  moves is neither.

  The cost model is the one the plan asks for: cost scales with the number of
  symbols, not with the number of people looking. The watchlist below is the
  same for everybody, so a thousand players share one fetch per symbol per
  minute between them, exactly as a thousand players holding AAPL do.
*/

/*
  Names a person would recognise without being told what they are, weighted
  towards the ones people actually talk about. Fixed rather than computed:
  a list that changed on its own would make "what moved" mean something
  different every day, and a screen full of tickers nobody has heard of is
  noise rather than news.

  Not a recommendation, not a shortlist, and not what the game is played on --
  every one of these is buyable in the house week, and so are thousands of
  companies that are not here.
*/
const WATCHLIST = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO",
  "AMD", "INTC", "NFLX", "DIS", "COST", "WMT", "NKE", "SBUX",
  "JPM", "GS", "V", "MA", "XOM", "CVX", "LLY", "PFE",
  "BA", "CAT", "UBER", "ABNB", "SHOP", "PLTR", "COIN", "HOOD",
  "F", "GM", "DAL", "SPOT",
] as const;

export type Mover = {
  symbol: string;
  name: string | null;
  price: number;
  changePercent: number;
  /** True when this is something the viewer holds. */
  owned: boolean;
  /** True when the price came from cache after a failed refresh. */
  stale: boolean;
};

export type MoversView = {
  /** Biggest risers first. */
  up: Mover[];
  /** Biggest fallers first. */
  down: Mover[];
  /** True when anything shown came from cache after a failed refresh. */
  anyStale: boolean;
};

/** How many each way. Six is a glance; twenty is a screen to scroll. */
const SHOWN = 4;

/**
 * The day's largest moves, from the watchlist and from what the viewer owns.
 *
 * Their own holdings are folded in because the day's news for somebody who
 * owns a thing is what that thing did, whether or not it is famous. They are
 * marked, so the row reads as "yours" rather than as a coincidence.
 *
 * Returns nothing rather than something wrong when prices are unavailable.
 * A movers panel with one name in it is worse than no movers panel.
 */
export async function getMovers(owned: readonly string[] = []): Promise<MoversView | null> {
  const held = new Set(owned.map((symbol) => symbol.toUpperCase()));
  const wanted = [...new Set([...WATCHLIST, ...held])];

  let quotes: Record<string, Quote>;
  try {
    quotes = await getQuotes(wanted);
  } catch {
    return null;
  }

  const rows: Mover[] = Object.values(quotes)
    .filter((quote) => Number.isFinite(quote.changePercent))
    /*
      A move of nothing is not a move.

      The threshold is the smallest one that survives being written down.
      Percentages are shown to one decimal place, so a company up 0.04 per cent
      renders as "+0.0%" -- a cell that has been given a colour, a border and a
      third of a row to say that nothing happened, which reads as a bug. Below
      this a name is left out, and if that empties the panel then the panel was
      not worth showing.
    */
    .filter((quote) => Math.abs(quote.changePercent) >= 0.05)
    .map((quote) => ({
      symbol: quote.symbol,
      name: quote.name,
      price: quote.price,
      changePercent: quote.changePercent,
      owned: held.has(quote.symbol),
      stale: quote.stale,
    }));

  // Not enough to fill a row honestly. Better to show none than to pad it.
  if (rows.length < SHOWN * 2) return null;

  const up = rows
    .filter((row) => row.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, SHOWN);

  const down = rows
    .filter((row) => row.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, SHOWN);

  if (up.length === 0 && down.length === 0) return null;

  return {
    up,
    down,
    anyStale: [...up, ...down].some((row) => row.stale),
  };
}

/** The watchlist, for a test that wants to know it is a real list. */
export const MOVERS_WATCHLIST = WATCHLIST;
