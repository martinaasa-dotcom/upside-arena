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

/*
  Built once, not once per question.

  Constructing an Intl.DateTimeFormat is the expensive half of using one, and
  every function below that needs to know the New York time asks through here:
  is it a weekday, what is the date, what is the Monday, how far to the close.
  Rendering one screen asked a dozen times and built a dozen formatters to
  answer. The formatter is stateless, so one lasts the life of the process.
*/
const NY_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIMEZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** The parts of the New York wall clock, whatever timezone the caller is in. */
function nyParts(now: Date) {
  const parts = NY_FORMAT.formatToParts(now);

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

/**
 * Whether the market has opened yet today, whether or not it is still open.
 *
 * Different question from isTradingOpen, and the difference is what makes a
 * lineup fair. Before 09:30 nobody knows what Monday's opening price will be,
 * so a lineup may still be changed. From 09:30 the price exists, and an order
 * that could still be edited would be a trade placed with hindsight -- which
 * is the one thing a lineup must never become.
 */
export function hasOpenedToday(now = new Date(), afterMinutes = 0): boolean {
  if (isWeekend(now)) return false;
  return nyMinutes(now) >= OPEN_MINUTES + afterMinutes;
}

/**
 * Whether a moment fell before a contest ending on the given day stopped
 * taking trades.
 *
 * Not the same question as "was it on or before that date", and the difference
 * is a whole evening. A contest that runs on market hours takes its last trade
 * at 16:00 on its final day, so somebody who arrives at nine that evening was
 * never in it however you write the date down. One whose market never shuts
 * takes trades until midnight, so for that one the whole day counts.
 *
 * Comparing the two as dates is what the first attempt at this did, by reading
 * a timestamp's first ten characters. That reads it in UTC, where the day
 * rolls over at seven or eight in the New York evening -- which happens to sit
 * near the close and made the answer accidentally about right, until it was
 * "fixed" into being reliably wrong.
 */
export function beforeContestEnd(
  moment: Date,
  endsOn: string,
  allDay = false
): boolean {
  const date = nyDate(moment);
  if (date < endsOn) return true;
  if (date > endsOn) return false;
  return allDay || nyMinutes(moment) < CLOSE_MINUTES;
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

/*
  Trading days, for the streak.

  A streak counts days the market was open, not days on the calendar.

  This is a deliberate departure from a plain daily counter. Arena cannot be
  played at the weekend: nothing moves, no trade can be placed, and there is
  no result to look at. Breaking someone's streak for not opening an app on a
  day the game does not run would be manufactured anxiety, which section 3 of
  the plan rules out as firmly as it rules out fake urgency. A streak that
  only counts the days that mattered is also the honest claim: you showed up
  when it counted.

  Market holidays are not modelled. A holiday is treated as a trading day, so
  the worst case is a streak that survives a day it might not have. Being
  generous in the player's favour is the right direction for that error.
*/

function isoToUtcNoon(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function utcToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Whether a New York calendar date fell on a weekday. */
export function isTradingDay(isoDate: string): boolean {
  const day = isoToUtcNoon(isoDate).getUTCDay();
  return day !== 0 && day !== 6;
}

/** The trading day before the given date. */
export function previousTradingDay(isoDate: string): string {
  const date = isoToUtcNoon(isoDate);
  do {
    date.setUTCDate(date.getUTCDate() - 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return utcToIso(date);
}

/**
 * Trading days strictly between two dates.
 *
 * This is how many days were actually missed, which is what decides whether a
 * streak survives on freezes or resets. Counting calendar days would end a
 * streak over a normal weekend.
 */
/**
 * How many trading days of this week have happened, today included.
 *
 * Monday is one, Friday is five, and the weekend is five because the week is
 * over. Used to tell a goal that is still open from one that can no longer be
 * met: on a Tuesday, somebody who has shown up once has missed a day, and
 * somebody who has shown up twice has not.
 */
export function tradingDaysSoFarThisWeek(now = new Date()): number {
  const { weekday } = nyParts(now);
  const index = WEEKDAY_INDEX[weekday] ?? 1;

  // Saturday and Sunday sit after a finished week, not inside the next one.
  if (index === 0 || index === 6) return 5;
  return index;
}

export function tradingDaysBetween(fromIso: string, toIso: string): number {
  if (fromIso >= toIso) return 0;

  const cursor = isoToUtcNoon(fromIso);
  const end = isoToUtcNoon(toIso);
  let count = 0;

  // Bounded so a corrupt date cannot spin here for ever.
  for (let guard = 0; guard < 400; guard++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor >= end) break;
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }

  return count;
}

/*
  The lineup, and which week it is for.

  A lineup is bought at a Monday's opening price, so the only week you can
  still queue for is one whose opening price nobody knows yet. That is this
  Monday until the bell, and the Monday after it from then on.
*/

/** Whether a week's lineup can still be changed. */
export function lineupLocked(monday: string, now = new Date()): boolean {
  const today = nyDate(now);
  if (today < monday) return false;
  if (today === monday && !hasOpenedToday(now)) return false;
  return true;
}

/**
 * Whether the lineup is the thing to show right now.
 *
 * True when the next opening bell is the one a lineup would fill at: all
 * weekend, and on the Monday itself until the market opens. The copy promises
 * a lineup can be changed until the bell on Monday, and a screen that only
 * offered it at the weekend was not keeping that promise -- somebody opening
 * Arena at eight on a Monday morning could neither trade nor see the thing
 * that was about to spend their money.
 */
export function isLineupWindow(now = new Date()): boolean {
  return isWeekend(now) || nyDate(now) === lineupMonday(now);
}

/**
 * The Monday a lineup queued now would be filled on.
 *
 * At the weekend that is the Monday about to arrive, which is the whole point
 * of the feature. During the week it is next Monday, because this week's
 * opening price has already happened.
 *
 * Note what this means and what it does not. It is the earliest week that is
 * still open, so `lineupLocked(lineupMonday())` is false by construction --
 * which is correct for choosing where a new order goes, and useless as a way
 * of deciding whether an existing order may still be removed. That question is
 * about the week the order is for, and only the database knows which week
 * that is. See 0021.
 */
export function lineupMonday(now = new Date()): string {
  const monday = cycleMonday(now);
  if (!lineupLocked(monday, now)) return monday;

  const next = isoToUtcNoon(monday);
  next.setUTCDate(next.getUTCDate() + 7);
  return utcToIso(next);
}

/**
 * Whether a week's lineup can be filled yet.
 *
 * Half an hour after the bell rather than on it. The opening price is what a
 * lineup fills at, and it does not exist in the data provider the instant the
 * market opens -- the daily bar for the day arrives a few minutes in. Filling
 * at 09:30:20 would mean recording "we had no opening price" for a name that
 * had one perfectly well by 09:35, and that error is written into somebody's
 * week and cannot be taken back.
 *
 * Waiting costs nothing. Everybody fills at the same opening price whenever
 * this runs, so the only thing being delayed is when they find out.
 */
const OPEN_PRICE_GRACE_MINUTES = 30;

export function lineupReady(monday: string, now = new Date()): boolean {
  const today = nyDate(now);
  if (today > monday) return true;
  return today === monday && hasOpenedToday(now, OPEN_PRICE_GRACE_MINUTES);
}
