import "server-only";

import { MAX_LINEUP_ORDERS } from "@/lib/game";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionOpen } from "@/lib/market/benchmark";
import { getQuotes, normaliseSymbol, type Quote } from "@/lib/market/quotes";
import { lineupLocked, lineupMonday, lineupReady, nyDate } from "@/lib/market/session";
import type { Cycle } from "@/lib/game/portfolio";
import type { LineupOrderRow } from "@/lib/supabase/database.types";

/*
  The lineup: what the weekend is for.

  Friday's close to Monday's open is sixty-five hours in which Arena can do
  nothing. No trade can be placed, no price moves, no standing changes. The
  app's answer used to be a sentence saying the market was closed.

  Which is a shame, because the weekend is when people actually talk about it.
  The week has just settled, somebody has been beaten by half a per cent, and
  the moment they want to do something about it is exactly the moment they are
  told to come back in two days and remember. That is how a player who was
  enjoying themselves on Saturday has a dead week by Wednesday.

  So over the weekend you say what you want to own, and it is bought for you at
  Monday's opening price.

  It is not a head start, and the three reasons are worth keeping together:

    Everybody fills at the same price. The session open on the Monday, whether
    the order was queued on Friday evening or the fill actually ran on
    Wednesday because nobody opened the app. There is no advantage in queueing
    late and none in being awake early.

    It locks at the bell. From 09:30 the opening price exists, so an order that
    could still be edited would be a trade placed with hindsight.

    Nothing is dropped quietly. An order that could not be priced, or that
    there was no longer cash for, is recorded as not having run and says so on
    screen. A feature that silently swallows an order is worse than no feature.
*/

export { MAX_LINEUP_ORDERS };

export type LineupOrder = {
  id: string;
  symbol: string;
  quantity: number;
  /** The company's name, when we have a live quote for it. */
  name: string | null;
  /** Roughly what it will cost, at the price right now. Null when unknown. */
  estimate: number | null;
  quote: Quote | null;
  ran: boolean;
  outcome: LineupOrderRow["outcome"];
  fillPrice: number | null;
  detail: string | null;
};

export type LineupView = {
  /** The Monday these orders are for. */
  monday: string;
  /** True once the bell has gone on that Monday and nothing may change. */
  locked: boolean;
  orders: LineupOrder[];
  /** What the whole lineup costs at today's prices. An estimate, and said so. */
  estimate: number;
  startingBalance: number;
  maxOrders: number;
};

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

/** The Monday a lineup queued right now would be filled on. */
export { lineupMonday };

/**
 * Somebody's lineup for a week, priced at today's prices so they can see
 * roughly what it will cost.
 *
 * The estimate is never presented as the price they will get. Monday's open is
 * not Friday's close and pretending otherwise would be the same invented
 * number this app refuses everywhere else.
 */
export async function getLineup(
  userId: string,
  monday: string,
  startingBalance: number
): Promise<LineupView> {
  const empty: LineupView = {
    monday,
    locked: lineupLocked(monday),
    orders: [],
    estimate: 0,
    startingBalance,
    maxOrders: MAX_LINEUP_ORDERS,
  };

  if (!canWriteGame) return empty;

  const admin = createAdminClient();
  const { data } = await admin
    .from("lineup_orders")
    .select("*")
    .eq("user_id", userId)
    .eq("monday", monday)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as LineupOrderRow[];
  if (rows.length === 0) return empty;

  const quotes = await getQuotes(rows.map((row) => row.symbol));

  const orders: LineupOrder[] = rows.map((row) => {
    const quantity = num(row.quantity);
    const quote = quotes[row.symbol] ?? null;

    return {
      id: row.id,
      symbol: row.symbol,
      quantity,
      name: quote?.name ?? null,
      estimate: quote ? quantity * quote.price : null,
      quote,
      ran: row.ran_at != null,
      outcome: row.outcome,
      fillPrice: row.fill_price == null ? null : num(row.fill_price),
      detail: row.detail,
    };
  });

  return {
    ...empty,
    orders,
    estimate: orders.reduce((sum, order) => sum + (order.estimate ?? 0), 0),
  };
}

export type LineupOutcome = { ok: true } | { ok: false; error: string };

export async function queueOrder(
  userId: string,
  monday: string,
  symbol: string,
  quantity: number
): Promise<LineupOutcome> {
  if (!canWriteGame) return { ok: false, error: "Not switched on yet." };

  const clean = normaliseSymbol(symbol);

  if (!/^[A-Z0-9.\-]{1,12}$/.test(clean)) {
    return { ok: false, error: "Pick a company from the list." };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: "Enter a whole number of shares." };
  }

  /*
    Whether the week has begun is worked out here, from the New York clock,
    and handed to the database. It is the entire fairness of this feature, so
    it is checked by a function only the server may call rather than by a row
    a player could write.
  */
  const admin = createAdminClient();
  const { error } = await admin.rpc("queue_lineup_order", {
    p_user_id: userId,
    p_monday: monday,
    p_symbol: clean,
    p_quantity: quantity,
    p_locked: lineupLocked(monday),
    p_max_orders: MAX_LINEUP_ORDERS,
  });

  if (error) {
    if (error.message.includes("locked")) {
      return {
        ok: false,
        error: "The market has opened, so this week's lineup is set. Trade instead.",
      };
    }
    if (error.message.includes("lineup is full")) {
      return {
        ok: false,
        error: `A lineup holds ${MAX_LINEUP_ORDERS} names. Take one out to add another.`,
      };
    }
    return { ok: false, error: "We could not save that. Try again." };
  }

  return { ok: true };
}

export async function clearOrder(
  userId: string,
  orderId: string,
  monday: string
): Promise<LineupOutcome> {
  if (!canWriteGame) return { ok: false, error: "Not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("clear_lineup_order", {
    p_user_id: userId,
    p_order_id: orderId,
    p_locked: lineupLocked(monday),
  });

  if (error) {
    if (error.message.includes("locked")) {
      return {
        ok: false,
        error: "The market has opened, so this week's lineup is set.",
      };
    }
    return { ok: false, error: "We could not take that out. Try again." };
  }

  return { ok: true };
}

/**
 * Whether anybody's lineup is waiting to run for this week.
 *
 * Cheap and indexed, because it is asked on a page render and the fill it
 * might trigger is not.
 */
export async function hasLineupToFill(
  userId: string,
  cycle: Cycle,
  now = new Date()
): Promise<boolean> {
  if (!canWriteGame) return false;
  if (cycle.status !== "open") return false;
  if (!lineupReady(cycle.monday, now)) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("lineup_orders")
    .select("id")
    .eq("user_id", userId)
    .lte("monday", cycle.monday)
    .is("ran_at", null)
    .limit(1);

  return (data ?? []).length > 0;
}

export type FillResult = {
  filled: number;
  missed: number;
};

/**
 * Runs a week's lineup, at that Monday's opening prices.
 *
 * The whole of the work is one database call, on purpose: an application that
 * claimed an order, placed the trade and then recorded the outcome has three
 * moments to die in, and every one of them leaves a player looking at a
 * lineup that does not describe what happened to their money.
 *
 * What is left here is the part the database cannot do, which is knowing what
 * a share opened at.
 */
export async function fillLineup(
  userId: string,
  cycle: Cycle,
  now = new Date()
): Promise<FillResult> {
  const nothing: FillResult = { filled: 0, missed: 0 };

  if (!canWriteGame) return nothing;
  if (cycle.status !== "open") return nothing;
  if (!lineupReady(cycle.monday, now)) return nothing;

  const admin = createAdminClient();

  /*
    Anything queued for a week that has already been and gone.

    This happens to somebody who queues a lineup on Saturday and then does not
    open Arena for a fortnight: the week they meant it for was settled while
    they were away. It cannot be filled -- that week has a result -- and it
    must not silently fill into the week they have come back to, which is a
    different race with different prices. So it is closed off and said so.
  */
  await admin
    .from("lineup_orders")
    .update({
      ran_at: new Date().toISOString(),
      outcome: "refused",
      detail: "That week was over by the time you came back, so nothing was bought.",
    })
    .eq("user_id", userId)
    .lt("monday", cycle.monday)
    .is("ran_at", null);

  const { data: pending } = await admin
    .from("lineup_orders")
    .select("symbol")
    .eq("user_id", userId)
    .eq("monday", cycle.monday)
    .is("ran_at", null);

  const symbols = [...new Set(((pending ?? []) as { symbol: string }[]).map((p) => p.symbol))];
  if (symbols.length === 0) return nothing;

  const opens = await Promise.all(
    symbols.map(async (symbol) => [symbol, await getSessionOpen(symbol, cycle.monday)] as const)
  );

  const prices: Record<string, number> = {};
  for (const [symbol, open] of opens) {
    if (open != null && open > 0) prices[symbol] = open;
  }

  const { data, error } = await admin.rpc("fill_lineup", {
    p_user_id: userId,
    p_cycle_id: cycle.id,
    p_monday: cycle.monday,
    p_prices: prices,
    p_today: nyDate(now),
  });

  if (error) return nothing;

  const rows = (data ?? []) as unknown as LineupOrderRow[];

  return {
    filled: rows.filter((row) => row.outcome === "filled").length,
    missed: rows.filter((row) => row.outcome !== "filled").length,
  };
}

/**
 * What a lineup did, for the one line the home screen says about it.
 *
 * Read after the fill rather than returned from it, because the fill happens
 * in the background of some earlier request and the screen that reports it is
 * usually a later one.
 *
 * Bounded by when it ran rather than by which week it was for, which is both
 * simpler and better behaved. "Your lineup ran" is news for a day or two and
 * then it is history, and a panel still announcing Monday's fill on Thursday
 * is a panel somebody has stopped reading. It also keeps this file from having
 * to ask portfolio.ts which week it is, and portfolio.ts already asks this one
 * to run a fill -- two modules importing each other is a knot worth not tying.
 */
const REPORT_FOR_HOURS = 48;

export async function getLatestLineupReport(
  userId: string
): Promise<{ filled: number; missed: LineupOrder[] } | null> {
  if (!canWriteGame) return null;

  const since = new Date(Date.now() - REPORT_FOR_HOURS * 60 * 60 * 1000);

  const admin = createAdminClient();
  const { data } = await admin
    .from("lineup_orders")
    .select("*")
    .eq("user_id", userId)
    .gte("ran_at", since.toISOString())
    .order("monday", { ascending: false });

  const rows = (data ?? []) as LineupOrderRow[];
  if (rows.length === 0) return null;

  // One week's worth. Two Mondays inside forty-eight hours is not possible,
  // but a report that could quietly merge two of them would be a wrong number
  // rather than a missing one.
  const monday = rows[0].monday;
  const week = rows.filter((row) => row.monday === monday);

  const missed = week
    .filter((row) => row.outcome !== "filled")
    .map((row) => ({
      id: row.id,
      symbol: row.symbol,
      quantity: num(row.quantity),
      name: null,
      estimate: null,
      quote: null,
      ran: true,
      outcome: row.outcome,
      fillPrice: row.fill_price == null ? null : num(row.fill_price),
      detail: row.detail,
    }));

  return { filled: week.length - missed.length, missed };
}
