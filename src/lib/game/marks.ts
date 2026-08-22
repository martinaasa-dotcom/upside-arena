import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { BENCHMARK_SYMBOL, MARKET_TIMEZONE } from "@/lib/game";
import { getQuotes } from "@/lib/market/quotes";
import { isTradingDay, nyDate } from "@/lib/market/session";

/*
  What every portfolio was worth at the end of each trading day.

  This exists for the share card. A single weekly percentage is a number; five
  daily marks are the shape of a week, and the shape is what makes a result
  worth pasting into a group chat rather than just reading. Wordle travelled
  on its grid, not on its score.

  The marks cannot be worked out afterwards. Prices move on, and a day not
  recorded on the day is gone for good, so this is written from a job rather
  than lazily on a page view. Recording it is idempotent and a mark already
  taken is never revised, because the close was the close.
*/

/** From this hour in New York, the day's close is settled enough to record. */
const RECORD_FROM_HOUR = 16;

/** And past this hour it is tomorrow's problem. */
const RECORD_UNTIL_HOUR = 23;

export type MarkResult = {
  date: string;
  recorded: number;
  skipped: string | null;
};

function nyHour(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  return Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
}

/** True once the market has closed and the day is worth writing down. */
export function isMarkHour(now = new Date()): boolean {
  const hour = nyHour(now);
  return hour >= RECORD_FROM_HOUR && hour < RECORD_UNTIL_HOUR;
}

/**
 * Records today's close for every portfolio in the open week.
 *
 * Called from the notification cron, which already runs through the trading
 * day. Safe to call every hour: a day is written once.
 */
export async function recordDailyMarks(now = new Date()): Promise<MarkResult> {
  const today = nyDate(now);
  const result: MarkResult = { date: today, recorded: 0, skipped: null };

  if (!canWriteGame) return { ...result, skipped: "not_configured" };
  if (!isTradingDay(today)) return { ...result, skipped: "not_a_trading_day" };
  if (!isMarkHour(now)) return { ...result, skipped: "market_still_open" };

  const admin = createAdminClient();

  const { data: cycles } = await admin
    .from("weekly_cycles")
    .select("id, starting_balance")
    .eq("status", "open")
    // The house week, not a league's battle. A mark is a bar on a share card
    // for the week everybody played, and a league running a three month
    // contest would otherwise be the newest open cycle every day of it.
    .is("league_id", null)
    .order("monday", { ascending: false })
    .limit(1);

  const cycle = (cycles ?? [])[0] as { id: string; starting_balance: string } | undefined;
  if (!cycle) return { ...result, skipped: "no_open_week" };

  const { data: portfolios } = await admin
    .from("portfolios")
    .select("id, cash, starting_balance")
    .eq("cycle_id", cycle.id);

  const rows = (portfolios ?? []) as {
    id: string;
    cash: string;
    starting_balance: string;
  }[];
  if (rows.length === 0) return { ...result, skipped: "nobody_playing" };

  const { data: holdingRows } = await admin
    .from("holdings")
    .select("portfolio_id, symbol, quantity")
    .in(
      "portfolio_id",
      rows.map((row) => row.id)
    );

  const holdings = (holdingRows ?? []) as {
    portfolio_id: string;
    symbol: string;
    quantity: string;
  }[];

  const symbols = [...new Set(holdings.map((holding) => holding.symbol))];

  /*
    One quote request for every symbol anyone holds, shared across all of
    them. The benchmark comes along so the same call answers whether the
    market data is working at all.
  */
  const quotes = await getQuotes([...symbols, BENCHMARK_SYMBOL]);

  // A price we do not have is a mark we do not write. A day recorded from a
  // guess would sit in somebody's shared card for ever.
  const missing = symbols.filter((symbol) => !quotes[symbol]);
  if (missing.length > 0) return { ...result, skipped: "prices_unavailable" };

  const byPortfolio = new Map<string, { symbol: string; quantity: number }[]>();
  for (const holding of holdings) {
    const list = byPortfolio.get(holding.portfolio_id) ?? [];
    list.push({ symbol: holding.symbol, quantity: Number(holding.quantity) });
    byPortfolio.set(holding.portfolio_id, list);
  }

  for (const row of rows) {
    const cash = Number(row.cash);
    const start = Number(row.starting_balance);

    const held = (byPortfolio.get(row.id) ?? []).reduce(
      (total, position) => total + position.quantity * (quotes[position.symbol]?.price ?? 0),
      0
    );

    const value = cash + held;
    const returnPercent = start > 0 ? ((value - start) / start) * 100 : 0;

    const { data: wrote } = await admin.rpc("record_portfolio_mark", {
      p_portfolio_id: row.id,
      p_date: today,
      p_value: Number(value.toFixed(2)),
      p_return_percent: Number(returnPercent.toFixed(4)),
    });

    if (wrote === true) result.recorded++;
  }

  return result;
}

/**
 * Whether today still needs recording, as one cheap indexed query.
 *
 * Called on page renders, so it has to stay far cheaper than the recording it
 * might trigger. A day already written makes this a single primary key lookup
 * and nothing else.
 */
export async function needsMarkToday(now = new Date()): Promise<boolean> {
  if (!canWriteGame) return false;

  const today = nyDate(now);
  if (!isTradingDay(today) || !isMarkHour(now)) return false;

  const admin = createAdminClient();

  const { data: cycles } = await admin
    .from("weekly_cycles")
    .select("id")
    .eq("status", "open")
    .is("league_id", null)
    .order("monday", { ascending: false })
    .limit(1);

  const cycle = (cycles ?? [])[0] as { id: string } | undefined;
  if (!cycle) return false;

  const { data: portfolios } = await admin
    .from("portfolios")
    .select("id")
    .eq("cycle_id", cycle.id)
    .limit(1);

  const portfolio = (portfolios ?? [])[0] as { id: string } | undefined;
  if (!portfolio) return false;

  const { count } = await admin
    .from("portfolio_marks")
    .select("portfolio_id", { count: "exact", head: true })
    .eq("portfolio_id", portfolio.id)
    .eq("on_date", today);

  return (count ?? 0) === 0;
}

/** The daily returns for one portfolio, oldest first. */
export async function getMarks(portfolioId: string): Promise<number[]> {
  if (!canWriteGame) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("portfolio_marks")
    .select("return_percent, on_date")
    .eq("portfolio_id", portfolioId)
    .order("on_date", { ascending: true });

  return ((data ?? []) as { return_percent: string }[]).map((row) =>
    Number(row.return_percent)
  );
}
