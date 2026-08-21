/*
  Market clock and week boundaries.

  The session helpers are taken from Upside Lab's `src/lib/market-session.ts`
  rather than rediscovered. They carry edge cases that only show up in
  production, in particular that Yahoo sometimes copies the live mark into
  previousClose overnight, which silently zeroes today's change.

  Arena adds the weekly cycle on top: a week runs Monday's open to Friday's
  close in New York, whatever timezone the player is in.
*/

import { MARKET_CLOSE, MARKET_OPEN, MARKET_TIMEZONE } from "@/lib/game";

export type SessionKind = "open" | "pre" | "ah" | "closed" | "unknown";

/**
 * Live mark and the close today's change should be measured against.
 *
 * Price is the newest print available: pre-market, leftover after-hours, or
 * the regular close. Never flatten the baseline to the live price, because
 * that zeroes today's change overnight once after-hours ends.
 */
export function sessionMark(input: {
  marketState: string | null;
  regularPrice: number | null;
  postPrice: number | null;
  prePrice: number | null;
  previousClose: number | null;
}): { price: number; previousClose: number } {
  const state = (input.marketState ?? "").toUpperCase();
  const { regularPrice, postPrice, prePrice, previousClose } = input;
  const inPre = state === "PRE" || state === "PREPRE";
  const near = (a: number, b: number) =>
    Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(b));

  const price = inPre
    ? (prePrice ?? postPrice ?? regularPrice ?? 0)
    : (postPrice ?? regularPrice ?? prePrice ?? 0);

  let baseline = inPre
    ? (regularPrice ?? previousClose ?? price)
    : (previousClose ?? regularPrice ?? price);

  // Yahoo sometimes copies the live mark into previousClose overnight, which
  // would show a flat day. Fall back to whichever close we still have.
  if (price > 0 && near(baseline, price)) {
    if (inPre && previousClose != null && previousClose > 0 && !near(previousClose, price)) {
      baseline = previousClose;
    } else if (
      !inPre &&
      regularPrice != null &&
      regularPrice > 0 &&
      !near(regularPrice, price)
    ) {
      baseline = regularPrice;
    }
  }

  return { price, previousClose: baseline };
}

export function sessionKind(state: string | null | undefined): SessionKind {
  const s = (state ?? "").toUpperCase();
  if (s === "REGULAR") return "open";
  if (s === "PRE" || s === "PREPRE") return "pre";
  if (s === "POST" || s === "POSTPOST") return "ah";
  if (s === "CLOSED") return "closed";
  return "unknown";
}

/** Plain words, no market jargon. */
export function sessionLabel(state: string | null | undefined): string {
  switch (sessionKind(state)) {
    case "open":
      return "Market open";
    case "pre":
      return "Before the open";
    case "ah":
      return "After the close";
    case "closed":
      return "Market closed";
    default:
      return "Market closed";
  }
}

/** The parts of the New York wall clock, whatever timezone the caller is in. */
function nyParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
  };
}

export function isWeekend(now = new Date()): boolean {
  const { weekday } = nyParts(now);
  return weekday === "Sat" || weekday === "Sun";
}

/** Minutes past midnight in New York. */
function nyMinutes(now: Date) {
  const { hour, minute } = nyParts(now);
  return hour * 60 + minute;
}

const OPEN_MINUTES = MARKET_OPEN.hour * 60 + MARKET_OPEN.minute;
const CLOSE_MINUTES = MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute;

/**
 * Whether trading is allowed right now.
 *
 * This is the regular session only. Arena does not accept trades before the
 * open or after the close, because a price outside the session moves on thin
 * volume and would make a week turn on who happened to be awake.
 *
 * Market holidays are not handled here. A holiday shows no new prices, so a
 * trade placed on one fills at the previous close, which is the same outcome
 * as a quiet day and is not worth a holiday calendar to avoid.
 */
export function isTradingOpen(now = new Date()): boolean {
  if (isWeekend(now)) return false;
  const minutes = nyMinutes(now);
  return minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES;
}

/** The New York calendar date, as YYYY-MM-DD. */
export function nyDate(now = new Date()): string {
  const { year, month, day } = nyParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * The Monday of the week `now` falls in, as a New York calendar date.
 *
 * Saturday and Sunday belong to the week that is about to start, not the one
 * that just finished, so someone joining at the weekend lands in the upcoming
 * race rather than a week whose result is already settled.
 */
export function cycleMonday(now = new Date()): string {
  const { weekday, year, month, day } = nyParts(now);
  const index = WEEKDAY_INDEX[weekday] ?? 1;

  // Anchor at noon UTC so adding days cannot cross a daylight-saving boundary.
  const anchor = Date.UTC(year, month - 1, day, 12);

  let shift: number;
  if (index === 0) shift = 1; // Sunday, next Monday
  else if (index === 6) shift = 2; // Saturday, next Monday
  else shift = 1 - index; // Weekday, back to this Monday

  const monday = new Date(anchor + shift * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
}

/** How much of the trading week is left, for a deadline a person can act on. */
export function hoursUntilClose(now = new Date()): number | null {
  if (isWeekend(now)) return null;
  const { weekday } = nyParts(now);
  if (weekday !== "Fri") return null;
  const remaining = CLOSE_MINUTES - nyMinutes(now);
  return remaining > 0 ? remaining / 60 : null;
}
