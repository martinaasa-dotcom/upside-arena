import { addDays } from "@/lib/market/session";

/*
  The shape of a week, as the days it is made of.

  A week has one number on it -- what it came to -- and that number is the
  least interesting thing about it. Somebody who was up four per cent on
  Tuesday and gave it all back on Thursday had a week worth talking about; the
  "+0.1%" it ended on says nothing at all. The shape is the story, and it is
  the reason a finished week is worth sharing.

  Which is why this exists twice over. The share card has always drawn a
  finished week from five settled marks. What was missing was the week
  somebody is actually in the middle of: on a Wednesday afternoon the app knew
  Monday's close, Tuesday's close and what the portfolio is worth right now,
  and showed only the last of the three. That is the difference between a
  scoreboard and a game.

  Everything here is pure. Dates in, days out, no clock read and no database,
  so both callers can be tested against a week that has already happened.
*/

/** One slot in a week: a day, and what the week stood at when it ended. */
export type ShapeDay = {
  /** Mon, Tue, and so on. */
  label: string;

  /** The New York calendar date, for a title attribute worth hovering. */
  date: string | null;

  /**
   * The return against the starting balance at that day's close, or null for
   * a day that has not happened yet -- or one the player was not here for.
   */
  returnPercent: number | null;

  /**
   * True for today, whose figure is a live price rather than a settled close.
   * Drawn differently, because it is the one bar that can still change.
   */
  live: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * A finished week from the marks it was settled with.
 *
 * The share card and the public week page both hold an array of daily
 * returns and nothing else, which is all a settled week needs: it has as many
 * days as it has, they start on the Monday, and none of them can change.
 */
export function settledWeek(marks: number[]): ShapeDay[] {
  return marks.map((returnPercent, index) => ({
    label: WEEKDAYS[index] ?? `Day ${index + 1}`,
    date: null,
    returnPercent,
    live: false,
  }));
}

/**
 * The week somebody is in the middle of.
 *
 * Five slots, always, so a week has its shape on Tuesday rather than growing
 * one bar at a time out of nothing. A day before today with no mark stays
 * empty on purpose: it means the player was not here for it, and drawing a
 * flat bar there would claim they held something and it went nowhere.
 *
 * Today gets the live figure, marked as live, unless the close has already
 * been recorded -- after four in the afternoon the settled mark is the better
 * of the two and they agree anyway.
 */
export function weekSoFar(input: {
  /** The Monday the week started on, in New York. */
  monday: string;

  /** Every close recorded for this portfolio so far. */
  marks: readonly { date: string; returnPercent: number }[];

  /** Today's New York calendar date. */
  today: string;

  /** What the portfolio is worth right now, against what it started with. */
  liveReturnPercent: number | null;
}): ShapeDay[] {
  const { monday, marks, today, liveReturnPercent } = input;

  const settled = new Map(marks.map((mark) => [mark.date, mark.returnPercent]));

  return WEEKDAYS.map((label, index) => {
    const date = addDays(monday, index);
    const mark = settled.get(date);

    if (mark != null) return { label, date, returnPercent: mark, live: false };

    const isToday = date === today;
    if (isToday && liveReturnPercent != null) {
      return { label, date, returnPercent: liveReturnPercent, live: true };
    }

    return { label, date, returnPercent: null, live: false };
  });
}

/**
 * Whether a week is worth drawing yet.
 *
 * One bar is not a shape. On a Monday there is nothing to compare today
 * against, so the panel stays away entirely rather than showing a single
 * column and four gaps, which reads as a chart that failed to load.
 */
export function worthDrawing(days: readonly ShapeDay[]): boolean {
  return days.filter((day) => day.returnPercent != null).length >= 2;
}
