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

/**
 * One close, as it was recorded on the day.
 *
 * The value and not only the percentage, because "how is today going" is a
 * question about the two values either side of last night, and deriving it
 * from two percentages of a starting balance answers a subtly different one.
 */
export type DailyMark = {
  date: string;
  value: number;
  returnPercent: number;
};

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
 * A finished week from the closes it was settled with.
 *
 * The array is the week itself: five slots, Monday first, and a slot that is
 * null is a day the player was not here for. See positionedWeek for why it
 * has to be laid out that way before it is stored rather than after.
 *
 * Shorter arrays are still accepted, because a card written before any of
 * this holds however many closes it holds and still has to draw.
 */
export function settledWeek(marks: readonly (number | null)[]): ShapeDay[] {
  return marks.map((returnPercent, index) => ({
    label: WEEKDAYS[index] ?? `Day ${index + 1}`,
    date: null,
    returnPercent,
    live: false,
  }));
}

/**
 * A finished week's closes laid out on the days they actually happened.
 *
 * This is the fix for something the share card had wrong from the start. It
 * held its closes as a plain list, oldest first, and the card drew the first
 * one under Monday. That is right for anybody who was playing on the Monday
 * and wrong for everybody else: somebody who signed up on the Wednesday has
 * three closes, and the card showed their Wednesday, Thursday and Friday as
 * Monday, Tuesday and Wednesday.
 *
 * Which is the worst possible place for it, because the card is the one
 * thing here that other people see, and a new player joining midweek is
 * exactly who is most likely to post one.
 *
 * Laying it out at the moment the card is made, rather than when it is
 * drawn, is deliberate: a card is frozen on purpose, and it should be frozen
 * holding a week that is already true rather than a list that needs its
 * cycle's Monday fetched back to be interpreted.
 */
export function positionedWeek(
  monday: string,
  marks: readonly DailyMark[]
): (number | null)[] {
  const settled = new Map(marks.map((mark) => [mark.date, mark.returnPercent]));
  return WEEKDAYS.map((_, index) => settled.get(addDays(monday, index)) ?? null);
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

/**
 * The last close before today, which is what today is measured against.
 *
 * Strictly before, and that is the whole of it. After four in the afternoon
 * today's own close is in the book, and measuring today against itself would
 * report every evening as a day on which nothing happened.
 */
export function lastCloseBefore(
  marks: readonly DailyMark[],
  today: string
): DailyMark | null {
  let best: DailyMark | null = null;
  for (const mark of marks) {
    if (mark.date >= today) continue;
    if (best == null || mark.date > best.date) best = mark;
  }
  return best;
}

/** What a day has done: in money, and against what it opened the day at. */
export type DayMove = {
  amount: number;
  percent: number;
};

/**
 * Today, as distinct from the week.
 *
 * By Thursday the week's figure barely moves -- a good day shifts it by a
 * fraction of a per cent and it reads as the same number it read yesterday.
 * The day inside it is the part that is actually happening, and it is a
 * different sum: today's percentage is against last night's value, not
 * against what the week started with.
 *
 * Null when there is nothing to measure against. On a Monday the last close
 * belongs to a week that has been settled and put away, and the week's own
 * figure is today's figure anyway.
 */
export function dayMove(totalValue: number, lastClose: DailyMark | null): DayMove | null {
  if (lastClose == null || lastClose.value <= 0) return null;

  const amount = totalValue - lastClose.value;
  return { amount, percent: (amount / lastClose.value) * 100 };
}

/*
  A contest too long to draw as bars.

  Five bars is a week. Sixty-five is a quarter, and sixty-five bars is a
  smear -- so a long contest is drawn as a line instead. Same principle
  underneath: zero is always in the scale, because a run that only ever went
  up measured from its own worst day looks exactly like one that only ever
  went down.

  The geometry is here rather than in the component so it can be checked
  against a run whose numbers are known. A chart that is quietly mis-scaled
  is the same class of problem as a figure that is quietly wrong, and harder
  to notice.
*/

export type TrailShape = {
  /*
    The run in two colours, split where it crosses what you started with.

    One colour for the whole line was the first attempt and it was quietly
    dishonest. A quarter that climbed to sixteen per cent and came back to
    just under nothing was drawn entirely in the losing colour, because the
    colour was taken from where it ended -- so the caption said the line
    across the middle is what everybody started with, and then painted three
    months of being well above it in the colour that means below.

    Segments are cut at the crossing rather than at the nearest close, so the
    colour changes exactly where the run does.
  */
  aheadLine: string;
  behindLine: string;
  aheadArea: string;
  behindArea: string;

  /** Where what you started with sits, in the same coordinates. */
  zeroY: number;

  /** The last point, for putting a mark on the end of the line. */
  endX: number;
  endY: number;
};

type TrailPoint = { x: number; value: number };

/**
 * Lays a run of closes out in a box.
 *
 * Points are spaced evenly by their position rather than by their date,
 * which is right for closes: they are trading days, and a weekend is not a
 * gap in a contest that does not trade over one.
 *
 * Null for a run with fewer than two points, because a line needs somewhere
 * to go and a single close is not a trajectory.
 */
export function trailShape(
  values: readonly number[],
  width: number,
  height: number
): TrailShape | null {
  if (values.length < 2) return null;

  const high = Math.max(...values, 0);
  const low = Math.min(...values, 0);
  const span = high - low || 1;

  const at = (index: number) => (index / (values.length - 1)) * width;
  const y = (value: number) => ((high - value) / span) * height;

  /*
    The points, with a point added wherever the run crosses zero. Without
    those the colour could only change at a close, so a run that went from
    plus two to minus three would have a whole day of its line drawn in one
    colour or the other and neither would be right for half of it.
  */
  const points: TrailPoint[] = [];
  values.forEach((value, index) => {
    if (index > 0) {
      const previous = values[index - 1];
      const crosses = (previous < 0 && value > 0) || (previous > 0 && value < 0);
      if (crosses) {
        const t = previous / (previous - value);
        points.push({ x: at(index - 1) + t * (at(index) - at(index - 1)), value: 0 });
      }
    }
    points.push({ x: at(index), value });
  });

  /*
    Split into runs that are entirely on one side. A point sitting exactly on
    the line belongs to the run before it and the run after it, so the two
    meet rather than leaving a gap the width of one segment.
  */
  const ahead: TrailPoint[][] = [];
  const behind: TrailPoint[][] = [];

  let run: TrailPoint[] = [];
  let side: 1 | -1 | 0 = 0;

  const close = () => {
    if (side !== 0 && run.length > 1) (side === 1 ? ahead : behind).push(run);
  };

  for (const point of points) {
    const here = point.value > 0 ? 1 : point.value < 0 ? -1 : 0;

    if (here === 0) {
      run.push(point);
      close();
      run = [point];
      side = 0;
      continue;
    }

    if (side === 0) {
      side = here;
      run.push(point);
      continue;
    }

    run.push(point);
  }
  close();

  const path = (runs: TrailPoint[][]) =>
    runs
      .map((one) => `M${one.map((p) => `${p.x.toFixed(2)},${y(p.value).toFixed(2)}`).join("L")}`)
      .join("");

  const zeroY = y(0);

  const area = (runs: TrailPoint[][]) =>
    runs
      .map((one) => {
        const first = one[0].x.toFixed(2);
        const last = one[one.length - 1].x.toFixed(2);
        const along = one
          .map((p) => `${p.x.toFixed(2)},${y(p.value).toFixed(2)}`)
          .join("L");
        return `M${first},${zeroY.toFixed(2)}L${along}L${last},${zeroY.toFixed(2)}Z`;
      })
      .join("");

  return {
    aheadLine: path(ahead),
    behindLine: path(behind),
    aheadArea: area(ahead),
    behindArea: area(behind),
    zeroY,
    endX: at(values.length - 1),
    endY: y(values[values.length - 1]),
  };
}
