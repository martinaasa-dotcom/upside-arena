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
 * Holidays count, now that there is a calendar to ask. That is not tidiness:
 * a trade on a day the market is shut fills at the last close, and the last
 * close on a holiday Monday is Friday's. Three days of news would be known
 * and the price would not have moved yet, which is the one thing a paper
 * game must never sell.
 */
export function isTradingOpen(now = new Date()): boolean {
  if (isWeekend(now)) return false;
  if (isMarketHoliday(nyDate(now))) return false;
  const minutes = nyMinutes(now);
  return minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES;
}

/**
 * Whether we are in the first half hour of today's regular session.
 *
 * A buying window, not a different market. The session is still the session;
 * this is only "are we early enough in it that a format which only opens at
 * the bell will take a buy". After 10:00 the market is open and this is not,
 * which is the whole point of the constraint.
 *
 * The window is half-open at the end, the same way the session itself is:
 * 09:30 counts, 10:00 does not.
 */
export function isOpeningBell(now = new Date(), windowMinutes = 30): boolean {
  if (!isTradingOpen(now)) return false;
  return nyMinutes(now) < OPEN_MINUTES + windowMinutes;
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
  if (!isTradingDay(nyDate(now))) return false;
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

/**
 * How long ago a contest ended, in hours, from New York's clock.
 *
 * Negative before it ends. Used by settlement to tell a company that has
 * stopped existing from an upstream hiccup: an hour after the close, a
 * missing price is most likely Yahoo having a moment, and six hours after it
 * the company is not coming back.
 *
 * allDay for the formats whose market never shuts, where the day ends at
 * midnight rather than at the bell.
 */
export function hoursSinceContestEnd(
  endsOn: string,
  allDay = false,
  now = new Date()
): number {
  const today = nyDate(now);
  const days =
    (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${endsOn}T12:00:00Z`)) /
    (24 * 60 * 60 * 1000);

  if (!Number.isFinite(days)) return 0;

  const endMinutes = allDay ? 24 * 60 : CLOSE_MINUTES;
  return (days * 24 * 60 + nyMinutes(now) - endMinutes) / 60;
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

  Market holidays used to be left out of this, on the reasoning that treating
  one as a trading day only ever left a streak surviving a day it might not
  have. That reasoning was wrong in the direction that matters. Crediting a
  visit on a holiday is indeed harmless; counting one as missed is not, and
  that is the case that actually happens. Somebody who looked in on the
  Wednesday, spent Thanksgiving away from a screen and came back on the Friday
  had a day counted against them for not opening a game whose market was shut,
  which is exactly the manufactured anxiety the paragraph above rules out.

  So the calendar is here, in full, computed rather than listed: ten holidays
  a year with the weekend rules the exchange actually uses. A holiday now
  behaves precisely as a Saturday does everywhere in the app. It costs no
  network call, no data file and nothing to maintain.

  What is deliberately not modelled is a half day. The market closes at 13:00
  on the day after Thanksgiving and on Christmas Eve when it falls midweek,
  and everything Arena does with a session either happens before that or after
  16:00, so the early close changes nothing here.
*/

/**
 * Easter Sunday, by the anonymous Gregorian algorithm.
 *
 * Here because Good Friday is the one market holiday with no fixed date and
 * no simple weekday rule, and it is a real one: the exchange is shut, no
 * price moves, and a streak must not care.
 */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The nth given weekday of a month, as a date. 0 is Sunday. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1, 12));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return iso(year, month, 1 + shift + (nth - 1) * 7);
}

/** The last given weekday of a month. */
function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0, 12));
  const shift = (last.getUTCDay() - weekday + 7) % 7;
  return iso(year, month, last.getUTCDate() - shift);
}

/**
 * A fixed-date holiday, moved to the day the exchange actually shuts.
 *
 * Saturday is observed on the Friday before and Sunday on the Monday after,
 * with one exception the exchange makes and this follows: New Year's Day on a
 * Saturday is not observed at all, because the Friday belongs to the year
 * before.
 */
function observed(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = date.getUTCDay();

  if (weekday === 6) {
    if (month === 1 && day === 1) return null;
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (weekday === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date.toISOString().slice(0, 10);
}

const holidayCache = new Map<number, Set<string>>();

/** Every day of a year the New York exchange is shut, other than weekends. */
function holidaysIn(year: number): Set<string> {
  const held = holidayCache.get(year);
  if (held) return held;

  const easter = easterSunday(year);
  const easterDay = new Date(Date.UTC(year, easter.month - 1, easter.day, 12));
  easterDay.setUTCDate(easterDay.getUTCDate() - 2);

  const days = [
    observed(year, 1, 1), // New Year's Day
    nthWeekday(year, 1, 1, 3), // Martin Luther King Jr Day
    nthWeekday(year, 2, 1, 3), // Washington's Birthday
    easterDay.toISOString().slice(0, 10), // Good Friday
    lastWeekday(year, 5, 1), // Memorial Day
    observed(year, 6, 19), // Juneteenth
    observed(year, 7, 4), // Independence Day
    nthWeekday(year, 9, 1, 1), // Labor Day
    nthWeekday(year, 11, 4, 4), // Thanksgiving
    observed(year, 12, 25), // Christmas Day
  ].filter((day): day is string => day != null);

  const set = new Set(days);
  holidayCache.set(year, set);
  return set;
}

/** Whether the exchange was shut on a New York calendar date for a holiday. */
export function isMarketHoliday(isoDate: string): boolean {
  const year = Number(isoDate.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  return holidaysIn(year).has(isoDate);
}

function isoToUtcNoon(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function utcToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * A calendar date a number of days on from another one.
 *
 * Noon rather than midnight, so a date is never nudged across a boundary by
 * an hour of daylight saving. Everything here is a New York calendar date
 * already, so this is plain calendar arithmetic and not a clock at all.
 */
export function addDays(isoDate: string, days: number): string {
  const date = isoToUtcNoon(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToIso(date);
}

/** Whether the market was open on a New York calendar date at all. */
export function isTradingDay(isoDate: string): boolean {
  const day = isoToUtcNoon(isoDate).getUTCDay();
  if (day === 0 || day === 6) return false;
  return !isMarketHoliday(isoDate);
}

/** The trading day before the given date. */
export function previousTradingDay(isoDate: string): string {
  const date = isoToUtcNoon(isoDate);
  do {
    date.setUTCDate(date.getUTCDate() - 1);
  } while (!isTradingDay(utcToIso(date)));
  return utcToIso(date);
}

/** The first day at or after the given one that the market is open. */
export function nextSessionOnOrAfter(isoDate: string): string {
  const date = isoToUtcNoon(isoDate);

  // Bounded, so a corrupt date cannot spin here for ever. Nothing shuts the
  // exchange for a fortnight.
  for (let guard = 0; guard < 14; guard++) {
    const day = utcToIso(date);
    if (isTradingDay(day)) return day;
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return isoDate;
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
  const monday = cycleMonday(now);
  const today = nyDate(now);

  /*
    Counted rather than taken from the weekday, because a week with a holiday
    in it is a shorter week. Somebody who showed up on the Tuesday of a week
    whose Monday was Memorial Day has missed nothing, and a goal measured
    against five days in a four day week is one nobody can meet.

    On a Saturday or a Sunday the Monday of the week ahead is the one that
    comes back, and the week just finished is over, so every one of its
    trading days counts.
  */
  if (monday > today) {
    let count = 0;
    for (let day = 0; day < 5; day++) {
      if (isTradingDay(addDays(previousWeekMonday(monday), day))) count++;
    }
    return count;
  }

  let count = 0;
  for (let day = 0; day < 5; day++) {
    const date = addDays(monday, day);
    if (date > today) break;
    if (isTradingDay(date)) count++;
  }

  return count;
}

/** The Monday before a Monday, for a weekend looking back at a finished week. */
function previousWeekMonday(monday: string): string {
  return addDays(monday, -7);
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
    if (isTradingDay(utcToIso(cursor))) count++;
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

  /*
    The first day the week actually trades, which is not always its Monday.

    Memorial Day, Labor Day and Martin Luther King Jr Day are all Mondays, and
    on one of those there is no opening price to fill at. This used to say the
    fill was ready at 10:00 on the Monday regardless, so every order queued
    for such a week was run against a session that did not exist and came back
    as "we had no opening price for that morning" -- a lineup silently thrown
    away on three weeks of the year, which is exactly the promise the feature
    was built on.
  */
  const first = nextSessionOnOrAfter(monday);

  if (today > first) return true;
  return today === first && hasOpenedToday(now, OPEN_PRICE_GRACE_MINUTES);
}
