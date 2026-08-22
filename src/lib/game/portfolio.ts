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
import { cycleMonday, isTradingOpen } from "@/lib/market/session";
import { hasDueCycle, settleDueCycles } from "@/lib/game/settle";
import { needsMarkToday, recordDailyMarks } from "@/lib/game/marks";

/*
  Reading and valuing a player's week.

  Everything a player sees is computed here from live prices, never stored as
  a snapshot. A stored "current value" would be wrong the moment a price
  moved, and a number that is quietly wrong is worse than one that is missing.
*/

export type Cycle = {
  id: string;
  monday: string;
  status: "open" | "scoring" | "closed";
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
  /** True when any price shown came from cache after a failed refresh. */
  anyStale: boolean;
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
  if (!canWriteGame) return null;

  /*
    Settle any week that has finished, in the background, so nobody waits for
    it. This is what makes correctness independent of a scheduler: a finished
    week is settled by the first person to look, not by a timer that may fire
    at the wrong hour or not at all.
  */
  if (await hasDueCycle()) {
    after(async () => {
      try {
        await settleDueCycles();
      } catch {
        // The next request tries again. A failed settle must never turn into
        // a failed page.
      }
    });
  }

  /*
    Today's closing value, on the same terms. A mark cannot be caught up
    later, because prices move on, so it must not depend on a schedule any
    more than settling does. The cron writes it promptly; this makes sure a
    day is never lost when the cron does not run.
  */
  if (await needsMarkToday()) {
    after(async () => {
      try {
        await recordDailyMarks();
      } catch {
        // A missing mark costs a bar on a share card and nothing else.
      }
    });
  }

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
    status: row.status as Cycle["status"],
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
 */
export async function getPortfolioView(
  userId: string
): Promise<PortfolioView | null> {
  const cycle = await getCurrentCycle();
  if (!cycle) return null;

  const portfolio = await ensurePortfolio(userId, cycle.id);
  if (!portfolio) return null;

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

  const admin = createAdminClient();
  const { data: holdingRows } = await admin
    .from("holdings")
    .select("symbol, quantity, cost_basis")
    .eq("portfolio_id", portfolio.id);

  const holdings = (holdingRows ?? []) as HoldingRow[];
  const symbols = holdings.map((h) => h.symbol);

  const [quotes, benchmarkOpenPrice] = await Promise.all([
    symbols.length ? getQuotes([...symbols, BENCHMARK_SYMBOL]) : getQuotes([BENCHMARK_SYMBOL]),
    Promise.resolve(cycle.benchmark_open),
  ]);

  let anyStale = false;

  const positions: Position[] = holdings.map((row) => {
    const symbol = row.symbol;
    const quantity = num(row.quantity);
    const costBasis = num(row.cost_basis);
    const quote = quotes[symbol] ?? null;

    if (quote?.stale) anyStale = true;

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
    anyStale,
  };
}

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
