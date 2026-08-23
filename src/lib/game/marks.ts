import "server-only";

import { cache } from "react";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { BENCHMARK_SYMBOL, MARKET_TIMEZONE } from "@/lib/game";
import { getQuotes } from "@/lib/market/quotes";
import { positionValue } from "@/lib/game/formats";
import { isTradingDay, nyDate } from "@/lib/market/session";
import type { DailyMark } from "@/lib/game/shape";
import { cycleCache } from "@/lib/game/cache";

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

  /**
   * How many portfolios held something nobody could price, and so were left
   * for the day rather than written down at a guess.
   */
  unpriced: number;

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
 * Records today's close for every portfolio in every contest that is running.
 *
 * Every contest, not only the house week. A battle can be a quarter long, and
 * a quarter with one figure on it and no trajectory tells you nothing about
 * the quarter -- the same thing that was true of the week before it was drawn
 * as five days. Marks cannot be worked out afterwards, so a day a battle was
 * not recorded is a day of its shape that is gone for good.
 *
 * Weekends are still not recorded, including for the format whose market
 * never shuts. The mark hour is the equity close, and inventing a closing
 * time for a market that does not have one would be making a number up; a
 * coin battle's Saturday shows up folded into the Monday it is next measured
 * at, which is honest about what was actually observed.
 *
 * Called from the notification cron, which already runs through the trading
 * day. Safe to call every hour: a day is written once.
 */
export async function recordDailyMarks(now = new Date()): Promise<MarkResult> {
  const today = nyDate(now);
  const result: MarkResult = { date: today, recorded: 0, unpriced: 0, skipped: null };

  if (!canWriteGame) return { ...result, skipped: "not_configured" };
  if (!isTradingDay(today)) return { ...result, skipped: "not_a_trading_day" };
  if (!isMarkHour(now)) return { ...result, skipped: "market_still_open" };

  const admin = createAdminClient();

  /*
    The direction comes along with the id, because it is what a position is
    worth. A short battle's holdings are worth what they have not cost --
    2 * cost - shares * price, floored -- and marking one at shares * price
    would write down a number nobody in that contest has ever been shown.
  */
  const { data: cycles } = await admin
    .from("weekly_cycles")
    .select("id, direction")
    .eq("status", "open");

  const openCycles = (cycles ?? []) as { id: string; direction: "long" | "short" }[];
  if (openCycles.length === 0) return { ...result, skipped: "no_open_week" };

  const directionOf = new Map(openCycles.map((cycle) => [cycle.id, cycle.direction]));

  const { data: portfolios } = await admin
    .from("portfolios")
    .select("id, cycle_id, cash, starting_balance")
    .in("cycle_id", [...directionOf.keys()]);

  const rows = (portfolios ?? []) as {
    id: string;
    cycle_id: string;
    cash: string;
    starting_balance: string;
  }[];
  if (rows.length === 0) return { ...result, skipped: "nobody_playing" };

  const { data: holdingRows } = await admin
    .from("holdings")
    .select("portfolio_id, symbol, quantity, cost_basis")
    .in(
      "portfolio_id",
      rows.map((row) => row.id)
    );

  const holdings = (holdingRows ?? []) as {
    portfolio_id: string;
    symbol: string;
    quantity: string;
    cost_basis: string;
  }[];

  const symbols = [...new Set(holdings.map((holding) => holding.symbol))];

  /*
    One quote request for every symbol anyone holds, shared across all of
    them. The benchmark comes along so the same call answers whether the
    market data is working at all.
  */
  const quotes = await getQuotes([...symbols, BENCHMARK_SYMBOL]);

  /*
    A price we do not have is a mark we do not write. A day recorded from a
    guess would sit in somebody's shared card for ever.

    Judged per portfolio rather than over the whole set. It used to be all or
    nothing, which was defensible while there was one contest and became
    dangerous the moment there were several: one unpriceable coin in one
    league's battle would have thrown away the day's closes for everybody
    playing the ordinary week, and a day not recorded cannot be recovered.
    A portfolio whose every symbol has a price is a portfolio we know the
    value of, whatever is going on elsewhere.
  */
  const byPortfolio = new Map<
    string,
    { symbol: string; quantity: number; costBasis: number }[]
  >();
  for (const holding of holdings) {
    const list = byPortfolio.get(holding.portfolio_id) ?? [];
    list.push({
      symbol: holding.symbol,
      quantity: Number(holding.quantity),
      costBasis: Number(holding.cost_basis),
    });
    byPortfolio.set(holding.portfolio_id, list);
  }

  for (const row of rows) {
    const cash = Number(row.cash);
    const start = Number(row.starting_balance);

    const held = byPortfolio.get(row.id) ?? [];

    if (held.some((position) => !quotes[position.symbol])) {
      result.unpriced++;
      continue;
    }

    const direction = directionOf.get(row.cycle_id) ?? "long";

    const value =
      cash +
      held.reduce(
        (total, position) =>
          total +
          positionValue(
            { direction },
            {
              quantity: position.quantity,
              costBasis: position.costBasis,
              price: quotes[position.symbol]?.price ?? null,
            }
          ),
        0
      );
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
 * might trigger. The database answers it, because the question is "does any
 * portfolio in any open contest still want today" and that is an anti-join
 * rather than something worth doing in three round trips.
 *
 * It used to look at one portfolio of one cycle and take that as the answer
 * for everything, which was true while there was only the week. With a league
 * battle running alongside it, the week having been written says nothing
 * about whether the battle was, and the day would have been quietly skipped
 * for one of them.
 */
export async function needsMarkToday(now = new Date()): Promise<boolean> {
  if (!canWriteGame) return false;

  const today = nyDate(now);
  if (!isTradingDay(today) || !isMarkHour(now)) return false;

  const admin = createAdminClient();
  const { data } = await admin.rpc("marks_needed_today", { p_date: today });

  return data === true;
}

/**
 * Every close recorded for one portfolio, oldest first, with its date.
 *
 * The date matters for a week still running. A player who joined on the
 * Wednesday has two marks, and placing them under Monday and Tuesday would
 * draw them a week they were not in.
 */
export const getDailyMarks = cache(async function getDailyMarks(
  portfolioId: string
): Promise<DailyMark[]> {
  /*
    Cached under the week rather than under a player, because the argument
    here is a portfolio id and the tag a mutation drops is a user id -- and a
    tag that can never match is worse than no tag, since it reads as
    invalidation that is not happening. Marks are written once a day by the
    first person to look, so the refresh below is what keeps them current.
  */
  "use cache";
  cycleCache();

  if (!canWriteGame) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("portfolio_marks")
    .select("return_percent, on_date, value")
    .eq("portfolio_id", portfolioId)
    .order("on_date", { ascending: true });

  return (data ?? []).map(toMark);
});

/**
 * The same, for a whole league at once.
 *
 * One request for every portfolio in the room rather than one per player.
 * The league table wants each member's last close so it can say who has had
 * the best day, and asking per member would be a query per row of a table
 * that is meant to be read at a glance.
 *
 * Not memoised, deliberately. React's cache compares arguments by identity,
 * and the argument here is a list built fresh on each call, so a cache on it
 * could never once hit -- it would read as protection that was not there.
 * The rooms that call this are themselves cached, which is where the repeat
 * is actually prevented.
 */
export async function getMarksFor(
  portfolioIds: readonly string[]
): Promise<Map<string, DailyMark[]>> {
  const byPortfolio = new Map<string, DailyMark[]>();
  if (!canWriteGame || portfolioIds.length === 0) return byPortfolio;

  const admin = createAdminClient();
  const { data } = await admin
    .from("portfolio_marks")
    .select("portfolio_id, return_percent, on_date, value")
    .in("portfolio_id", [...portfolioIds])
    .order("on_date", { ascending: true });

  for (const row of (data ?? []) as (MarkRow & { portfolio_id: string })[]) {
    const list = byPortfolio.get(row.portfolio_id) ?? [];
    list.push(toMark(row));
    byPortfolio.set(row.portfolio_id, list);
  }

  return byPortfolio;
}

type MarkRow = {
  on_date: string;
  value: string | number;
  return_percent: string | number;
};

function toMark(row: MarkRow): DailyMark {
  return {
    date: row.on_date,
    value: Number(row.value),
    returnPercent: Number(row.return_percent),
  };
}
