/*
  How long a contest runs for.

  The week is the heartbeat and stays the heartbeat: everybody level on
  Monday, settled at Friday's close, nothing carried over. It is short enough
  that a bad week is forgotten by Tuesday, which is the whole reason people
  come back.

  But a game whose only unit is five days rewards exactly one style of play,
  and it is the twitchy one. Somebody who wants to buy three companies and not
  look at them until spring has nowhere to do that here, and telling them the
  week is the point does not make them wrong. So a battle can be a day, a
  week, a fortnight, a month, a quarter or a year, and the longer ones are a
  genuinely different game rather than a longer version of the same one:
  nobody resets, the trade limit stops mattering, and the person who fiddles
  most usually loses.

  Pure, and free of any clock. The caller supplies today's New York date the
  same way every other date-sensitive thing in this app does, so a player in
  Auckland and a settler in Frankfurt agree on when a contest ended.
*/

export type LengthId = "day" | "week" | "fortnight" | "month" | "quarter" | "year";

export type RunLength = {
  id: LengthId;
  name: string;
  /** One line on the card. */
  tagline: string;
  /**
   * How many trading weeks it runs. Zero means the single day it starts on.
   */
  weeks: number;
  /** What to call the thing while it is running. */
  noun: string;
};

export const LENGTHS: readonly RunLength[] = [
  {
    id: "day",
    name: "One day",
    tagline: "Settled at tonight's close. Nothing to think about tomorrow.",
    weeks: 0,
    noun: "day",
  },
  {
    id: "week",
    name: "One week",
    tagline: "The usual shape, with a different rule book.",
    weeks: 1,
    noun: "week",
  },
  {
    id: "fortnight",
    name: "Two weeks",
    tagline: "Long enough that one bad Tuesday is not the whole story.",
    weeks: 2,
    noun: "fortnight",
  },
  {
    id: "month",
    name: "A month",
    tagline: "Four weeks. Now it matters what you own, not when you clicked.",
    weeks: 4,
    noun: "month",
  },
  {
    id: "quarter",
    name: "A quarter",
    tagline: "Thirteen weeks. Pick well and go and live your life.",
    weeks: 13,
    noun: "quarter",
  },
  {
    id: "year",
    name: "A year",
    tagline: "Fifty-two weeks. The one you will still be arguing about at Christmas.",
    weeks: 52,
    noun: "year",
  },
];

export const LENGTH_IDS = LENGTHS.map((length) => length.id);

export function isLengthId(value: string): value is LengthId {
  return (LENGTH_IDS as string[]).includes(value);
}

export function lengthById(id: string | null | undefined): RunLength {
  return LENGTHS.find((length) => length.id === id) ?? LENGTHS[1];
}

/*
  Dates are handled as YYYY-MM-DD strings anchored at noon UTC, which is the
  same trick the market session helpers use: noon is far enough from both
  midnights that adding whole days can never cross a daylight-saving boundary
  and land on the day before.
*/
function atNoon(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = atNoon(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** 1 for Monday through 7 for Sunday. */
function weekdayIndex(iso: string) {
  const day = atNoon(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * The first day a contest starting on the given date can actually run.
 *
 * A battle started on a Saturday belongs to the week that is about to begin,
 * not the one that just finished — the same rule the weekly cycle already
 * uses, for the same reason. Nothing moves at the weekend, so a contest that
 * "started" on Sunday would have spent a third of a one-day run shut.
 */
export function runStartsOn(todayIso: string): string {
  const index = weekdayIndex(todayIso);
  if (index === 6) return addDays(todayIso, 2);
  if (index === 7) return addDays(todayIso, 1);
  return todayIso;
}

/**
 * When a contest of this length, started on this day, is settled.
 *
 * Every length but the single day ends at a Friday close, so a result always
 * lands with the weekend in front of it rather than in the middle of a
 * Wednesday afternoon.
 *
 * Starting one on a Friday does not give somebody a one-day week. A week
 * needs at least two days left in it to be a week, so a battle begun on
 * Friday runs to the Friday after.
 */
export function runEndsOn(startIso: string, id: LengthId): string {
  const start = runStartsOn(startIso);
  const length = lengthById(id);

  if (length.weeks === 0) return start;

  const index = weekdayIndex(start);
  const daysToFriday = 5 - index;

  // Monday to Thursday still has a week in it. Friday does not.
  const firstFriday =
    daysToFriday >= 1 ? addDays(start, daysToFriday) : addDays(start, 7 + daysToFriday);

  return addDays(firstFriday, (length.weeks - 1) * 7);
}

/** Whether a contest has finished, given today's New York date. */
export function hasEnded(endsOn: string, todayIso: string): boolean {
  return endsOn < todayIso;
}

/** Calendar days from one date to another, for a countdown. */
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = atNoon(toIso).getTime() - atNoon(fromIso).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * How much of a contest is left, in the words it would be said in.
 *
 * Deliberately vague past a fortnight. "Ends in 46 days" is a number nobody
 * can act on, and a countdown on something three months out is manufactured
 * urgency, which this product does not do.
 */
export function timeLeft(endsOn: string, todayIso: string): string {
  const days = daysBetween(todayIso, endsOn);

  if (days < 0) return "Finished";
  if (days === 0) return "Ends at tonight's close";
  if (days === 1) return "Ends at tomorrow's close";
  if (days <= 14) return `${days} days left`;

  const weeks = Math.round(days / 7);
  if (weeks < 9) return `About ${weeks} weeks left`;

  const months = Math.round(days / 30);
  return `About ${months} months left`;
}
