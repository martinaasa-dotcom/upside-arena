import "server-only";

import { cache } from "react";
import { after } from "next/server";
import {
  BENCHMARK_SYMBOL,
  MAX_TRADES_PER_CYCLE,
  MAX_TRADES_PER_MINUTE,
  STARTING_BALANCE,
} from "@/lib/game";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuotes, normaliseSymbol, type Quote } from "@/lib/market/quotes";
import { getSessionOpen } from "@/lib/market/benchmark";
import { placeInPod } from "@/lib/game/pods";
import { cycleMonday, isTradingOpen, nyDate } from "@/lib/market/session";
import { hasDueCycle, settleDueCycles } from "@/lib/game/settle";
import { needsMarkToday, recordDailyMarks } from "@/lib/game/marks";
import { applyDueSplits } from "@/lib/game/splits";
import { reportServerError } from "@/lib/errors";
import { fillLineup, hasLineupToFill } from "@/lib/game/lineup";
import { checkTrade, formatById } from "@/lib/game/formats";
import { cycleCache, playerCache } from "@/lib/game/cache";
import { STUB, pretendSlow } from "@/lib/stub";

/*
  Reading and valuing a player's week.

  Everything a player sees is computed here from live prices, never stored as
  a snapshot. A stored "current value" would be wrong the moment a price
  moved, and a number that is quietly wrong is worse than one that is missing.
*/

export type Cycle = {
  id: string;
  monday: string;
  /** The day it is settled at the close. The Monday plus four, for a week. */
  ends_on: string;
  status: "open" | "scoring" | "closed";
  /** A format id. The house week is always the open market. */
  format: string;
  direction: "long" | "short";
  benchmark_symbol: string;
  benchmark_open: number | null;
  benchmark_close: number | null;
  starting_balance: number;
};

export type Position = {
  symbol: string;
  quantity: number;
  costBasis: number;
  /** What it cost per share on average. */
  averageCost: number;
  quote: Quote | null;
  /** Current worth of the position, or its cost if no price is available. */
  value: number;
  /** Gain or loss against what was paid. */
  gain: number;
  gainPercent: number;
};

export type PortfolioView = {
  cycle: Cycle;
  portfolioId: string;
  startingBalance: number;
  cash: number;
  positions: Position[];
  /** Cash plus everything held. */
  totalValue: number;
  /** Percent move on the starting balance. */
  returnPercent: number;
  /** The market's own move over the same week, if we know it. */
  benchmarkReturnPercent: number | null;
  /** How far ahead of the market the player is, in percentage points. */
  versusMarket: number | null;
  tradingOpen: boolean;
  /**
   * Whether the market is open, taken from the benchmark quote.
   *
   * Never read this from a holding: a player who owns nothing has no quote to
   * read it from, and the screen would claim the market was shut on a
   * Wednesday afternoon.
   */
  marketState: string | null;
  /*
    When the oldest price on this screen was actually fetched, and only when
    a refresh has failed and the cache is being served in its place.

    Null in the ordinary case, which is almost always: quotes live for sixty
    seconds, so a reading of how old they are is worth showing exactly when
    that ceiling has stopped holding. Home turns it into a quiet line saying
    how far behind the figures are.
  */
  staleSince: number | null;
};

type PortfolioRow = {
  id: string;
  cash: string | number;
  starting_balance: string | number;
};

type HoldingRow = {
  symbol: string;
  quantity: string | number;
  cost_basis: string | number;
};

/** Postgres returns numerics as strings, to avoid float rounding. */
function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

/**
 * The week in progress, creating it if this is the first time anyone has
 * asked. A new player never waits for Monday.
 */
export const getCurrentCycle = cache(async (): Promise<Cycle | null> => {
  "use cache";
  cycleCache();

  if (!canWriteGame) return null;

  /*
    Housekeeping, entirely after the response.

    Settling a finished week and recording the day's close are both done by
    the first person to look rather than by a timer, which is what makes
    correctness independent of a scheduler. Neither changes a single pixel of
    the page that triggers them, so neither is allowed to delay it: the
    questions "is a week due?" and "is a mark missing?" are database round
    trips in their own right, and asking them before rendering charged every
    reader for work done on somebody else's behalf.

    Deciding inside after() keeps the same guarantee -- the checks still run
    on the same visits they always did -- and moves the whole cost off the
    critical path.
  */
  after(async () => {
    try {
      if (await hasDueCycle()) await settleDueCycles();
    } catch (error) {
      /*
        The next request tries again, and a failed settle must never turn into
        a failed page. It is still written down: this is background work
        nobody is watching, so a settle that fails every time from now on
        would otherwise look exactly like a settle that has not run yet.
      */
      await reportServerError(error, "settle");
    }
  });

  /*
    Share splits, which change a position without anybody trading it.

    On the schedule this rides the trading day pass, and this is the backstop
    for a day the pass did not run. It costs one claim attempt: the first
    caller after the opening bell takes the day and looks, and everybody after
    that is told it is taken and stops. Before the bell it does not even
    claim.
  */
  after(async () => {
    try {
      await applyDueSplits();
    } catch (error) {
      // Tomorrow's check finds it, and the ledger means finding it twice
      // costs nothing. Never worth failing a page over, and worth knowing.
      await reportServerError(error, "splits");
    }
  });

  after(async () => {
    try {
      if (await needsMarkToday()) await recordDailyMarks();
    } catch (error) {
      /*
        A missing mark used to cost a bar on a share card. Since 0022 it also
        costs a day of every running battle's trajectory, and a day not
        recorded on the day cannot be worked out afterwards -- so this is
        worth more than it was, though still not worth failing a page over.
        Which is exactly why it is written down rather than swallowed.
      */
      await reportServerError(error, "marks");
    }
  });

  const monday = cycleMonday();
  const admin = createAdminClient();

  // The benchmark's opening price is what the week is measured from. It is
  // unknown until the market opens, so this is allowed to be null for now.
  const benchmarkOpen = await getSessionOpen(BENCHMARK_SYMBOL, monday);

  const { data, error } = await admin.rpc("ensure_cycle", {
    p_monday: monday,
    p_starting_balance: STARTING_BALANCE,
    p_benchmark_open: benchmarkOpen,
  });

  if (error || !data) return null;

  const row = data as unknown as Record<string, unknown>;
  return {
    id: row.id as string,
    monday: row.monday as string,
    ends_on: row.ends_on as string,
    status: row.status as Cycle["status"],
    format: (row.format as string) ?? "open",
    direction: (row.direction as Cycle["direction"]) ?? "long",
    benchmark_symbol: row.benchmark_symbol as string,
    benchmark_open: row.benchmark_open == null ? null : num(row.benchmark_open as string),
    benchmark_close: row.benchmark_close == null ? null : num(row.benchmark_close as string),
    starting_balance: num(row.starting_balance as string),
  };
});

/** The player's portfolio for the current week, created on first sight. */
async function ensurePortfolio(userId: string, cycleId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("ensure_portfolio", {
    p_user_id: userId,
    p_cycle_id: cycleId,
  });

  if (error || !data) return null;
  return data as unknown as PortfolioRow;
}

/**
 * Everything the home screen needs, priced now.
 *
 * One quote request covers every symbol held, and the quote layer shares
 * those fetches across everyone looking at the same names.
 *
 * Memoised per request, because Home no longer asks for this once at the top
 * and then renders. Each figure streams in on its own, so several components
 * ask for the same view within one render and must not each go and price a
 * portfolio to answer.
 */
/*
  The invented player's week, for the probe. See lib/stub.
*/
function stubQuote(symbol: string, price: number, name: string): Quote {
  return {
    symbol,
    price,
    previousClose: price * 0.98,
    change: price * 0.02,
    changePercent: 2,
    currency: "USD",
    marketState: "REGULAR",
    name,
    type: "EQUITY",
    fetchedAt: 0,
    stale: false,
  };
}

function stubView(): PortfolioView {
  const held = [
    { symbol: "AAPL", quantity: 12, price: 214.5, name: "Apple Inc." },
    { symbol: "MSFT", quantity: 5, price: 431.2, name: "Microsoft Corporation" },
    { symbol: "NVDA", quantity: 8, price: 128.9, name: "NVIDIA Corporation" },
  ];

  const positions: Position[] = held.map((h) => {
    const quote = stubQuote(h.symbol, h.price, h.name);
    const costBasis = h.quantity * h.price * 0.95;
    const value = h.quantity * h.price;
    return {
      symbol: h.symbol,
      quantity: h.quantity,
      costBasis,
      averageCost: costBasis / h.quantity,
      quote,
      value,
      gain: value - costBasis,
      gainPercent: ((value - costBasis) / costBasis) * 100,
    };
  });

  const cash = 1240.5;
  const totalValue = cash + positions.reduce((sum, p) => sum + p.value, 0);

  return {
    cycle: {
      id: "00000000-0000-4000-8000-0000000000c1",
      monday: "2026-08-17",
      ends_on: "2026-08-21",
      status: "open",
      format: "open",
      direction: "long",
      benchmark_symbol: BENCHMARK_SYMBOL,
      benchmark_open: 765.72,
      benchmark_close: null,
      starting_balance: STARTING_BALANCE,
    },
    portfolioId: "00000000-0000-4000-8000-0000000000p1".replace("p", "b"),
    startingBalance: STARTING_BALANCE,
    cash,
    positions,
    totalValue,
    returnPercent: ((totalValue - STARTING_BALANCE) / STARTING_BALANCE) * 100,
    benchmarkReturnPercent: 1.4,
    versusMarket: 0.9,
    tradingOpen: true,
    marketState: "REGULAR",
    staleSince: null,
  };
}

/*
  The oldest print among the ones that came back from cache after a failed
  refresh, or null when every price is current.

  The oldest rather than the newest, because a screen saying how far behind
  it is has to answer for the worst figure on it. The benchmark is in here
  too: it is what "The market" is measured from, and a player reading a
  comparison against a price from an hour ago should be told.
*/
export function oldestStale(quotes: Record<string, Quote>): number | null {
  let oldest: number | null = null;

  for (const quote of Object.values(quotes)) {
    if (!quote.stale) continue;
    if (oldest == null || quote.fetchedAt < oldest) oldest = quote.fetchedAt;
  }

  return oldest;
}

export const getPortfolioView = cache(async function getPortfolioView(
  userId: string
): Promise<PortfolioView | null> {
  "use cache";
  playerCache(userId);

  if (STUB) {
    await pretendSlow();
    return stubView();
  }

  const cycle = await getCurrentCycle();
  if (!cycle) return null;

  /*
    The market's own price, asked for now rather than at the end.

    What every player is measured against is the same one symbol for all of
    them, and it does not depend on anything below: not this player, not their
    portfolio, not what they hold. Asked for after the holdings came back, its
    round trip to the quote provider sat on the end of three database round
    trips it could perfectly well have run alongside.

    Not awaited here. The quote layer already collapses two asks for one
    symbol into one fetch, so the request below finds this either finished or
    in flight, and either way it does not queue behind it.
  */
  const benchmark = getQuotes([BENCHMARK_SYMBOL]);

  const portfolio = await ensurePortfolio(userId, cycle.id);
  if (!portfolio) {
    // Nothing will read it now, and an unobserved promise must not be left to
    // reject into the void.
    await benchmark.catch(() => undefined);
    return null;
  }

  /*
    And a pod, if pods are running this week. Section 2.2 is firm that nobody
    faces a wait until Monday, so placement happens the first time somebody
    looks rather than on a schedule. It costs one query when pods are off, and
    a placement that fails is not allowed to fail the page: a missing pod is a
    room that is not offered, not a broken portfolio.
  */
  after(async () => {
    try {
      await placeInPod(userId, cycle.id);
    } catch {
      // The next visit tries again.
    }
  });

  /*
    And the lineup, if they left one at the weekend.

    Same shape as everything else here: the question "is there one waiting?" is
    a cheap indexed read and the filling is not, so both happen after the
    response rather than in front of it. It is the first visit of the new week
    that runs it, which is the visit where the answer is about to be shown.

    A fill that fails is not allowed to fail the page. The orders are still
    unrun, so the next visit tries again; what must never happen is a player
    seeing an error where their money should be.
  */
  after(async () => {
    try {
      if (await hasLineupToFill(userId, cycle)) await fillLineup(userId, cycle);
    } catch {
      // The next visit tries again.
    }
  });

  const admin = createAdminClient();
  const { data: holdingRows } = await admin
    .from("holdings")
    .select("symbol, quantity, cost_basis")
    .eq("portfolio_id", portfolio.id);

  const holdings = (holdingRows ?? []) as HoldingRow[];
  const symbols = holdings.map((h) => h.symbol);

  const [held, benchmarkQuotes] = await Promise.all([
    symbols.length
      ? getQuotes(symbols)
      : Promise.resolve({} as Record<string, Quote>),
    benchmark,
  ]);

  const quotes = { ...benchmarkQuotes, ...held };
  const benchmarkOpenPrice = cycle.benchmark_open;

  const positions: Position[] = holdings.map((row) => {
    const symbol = row.symbol;
    const quantity = num(row.quantity);
    const costBasis = num(row.cost_basis);
    const quote = quotes[symbol] ?? null;

    // With no price at all, the position is shown at cost rather than at
    // zero. Zero would look like a wipeout that never happened.
    const value = quote ? quantity * quote.price : costBasis;
    const gain = value - costBasis;

    return {
      symbol,
      quantity,
      costBasis,
      averageCost: quantity > 0 ? costBasis / quantity : 0,
      quote,
      value,
      gain,
      gainPercent: costBasis > 0 ? (gain / costBasis) * 100 : 0,
    };
  });

  const cash = num(portfolio.cash);
  const startingBalance = num(portfolio.starting_balance);
  const totalValue = cash + positions.reduce((sum, p) => sum + p.value, 0);
  const returnPercent =
    startingBalance > 0 ? ((totalValue - startingBalance) / startingBalance) * 100 : 0;

  const benchmarkQuote = quotes[BENCHMARK_SYMBOL] ?? null;
  const benchmarkReturnPercent =
    benchmarkOpenPrice && benchmarkOpenPrice > 0 && benchmarkQuote
      ? ((benchmarkQuote.price - benchmarkOpenPrice) / benchmarkOpenPrice) * 100
      : null;

  return {
    cycle,
    portfolioId: portfolio.id,
    startingBalance,
    cash,
    positions: positions.sort((a, b) => b.value - a.value),
    totalValue,
    returnPercent,
    benchmarkReturnPercent,
    versusMarket:
      benchmarkReturnPercent == null ? null : returnPercent - benchmarkReturnPercent,
    tradingOpen: cycle.status === "open" && isTradingOpen(),
    marketState: benchmarkQuote?.marketState ?? null,
    staleSince: oldestStale(quotes),
  };
})
export type TradeOutcome =
  | { ok: true; symbol: string; side: "buy" | "sell"; quantity: number; price: number }
  | { ok: false; error: string };

/**
 * Places a trade at the price the server sees.
 *
 * The price is never taken from the caller. It is read here, from the shared
 * quote cache, and handed to a database function that only the server may
 * call. That is the whole reason a player cannot write their own holdings.
 */
export async function placeTrade(
  userId: string,
  input: { symbol: string; side: "buy" | "sell"; quantity: number }
): Promise<TradeOutcome> {
  if (!canWriteGame) {
    return { ok: false, error: "Trading is not switched on yet." };
  }

  const symbol = normaliseSymbol(input.symbol);

  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
    return { ok: false, error: "That does not look like a company we can find." };
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: "Enter a whole number of shares." };
  }

  if (!isTradingOpen()) {
    return {
      ok: false,
      error: "The market is closed. Trading opens on weekdays from 09:30 to 16:00 New York time.",
    };
  }

  const cycle = await getCurrentCycle();
  if (!cycle) {
    return { ok: false, error: "We could not find this week. Try again in a moment." };
  }

  const quotes = await getQuotes([symbol]);
  const quote = quotes[symbol];

  if (!quote) {
    return { ok: false, error: `We could not find a price for ${symbol}.` };
  }

  // A stale price is a price nobody should be filled at. Refusing is fairer
  // than filling everyone at a number that stopped being true.
  if (quote.stale) {
    return {
      ok: false,
      error: "Prices are not updating right now. Try again in a minute.",
    };
  }

  /*
    What the house week allows, which is shares and funds and nothing else.

    The quote layer will happily price a coin, because a format asks it to.
    That is not permission to own one here: a market that never shuts would
    make the house week turn on who was awake at three in the morning on
    Saturday, which is precisely the game this one is not. Coins have their
    own format, and it says so on the card.
  */
  const allowed = checkTrade(formatById(cycle.format), {
    symbol,
    side: input.side,
    quantity: input.quantity,
    price: quote.price,
    startingBalance: cycle.starting_balance,
    positions: [],
    quoteType: quote.type,
  });

  if (!allowed.ok) return { ok: false, error: allowed.error };

  const admin = createAdminClient();
  const { error } = await admin.rpc("execute_trade", {
    p_user_id: userId,
    p_cycle_id: cycle.id,
    p_symbol: symbol,
    p_side: input.side,
    p_quantity: input.quantity,
    p_price: quote.price,
    p_max_per_minute: MAX_TRADES_PER_MINUTE,
    p_max_per_cycle: MAX_TRADES_PER_CYCLE,
    p_today: nyDate(),
  });

  if (error) {
    // The database raises these in plain language already, so pass them on
    // rather than replacing them with something vaguer.
    return { ok: false, error: friendlyTradeError(error.message) };
  }

  return {
    ok: true,
    symbol,
    side: input.side,
    quantity: input.quantity,
    price: quote.price,
  };
}

function friendlyTradeError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("not enough cash")) return "You do not have enough cash for that.";
  if (text.includes("do not own")) return "You do not own that many shares.";
  if (text.includes("slow down")) return "That is a lot of trades at once. Give it a moment.";
  if (text.includes("trade limit")) return "You have hit the trade limit for this week.";
  if (text.includes("closed for trading")) return "This week is finished. Trading opens again on Monday.";
  if (text.includes("whole number")) return "Enter a whole number of shares.";
  return "We could not place that trade. Try again.";
}
