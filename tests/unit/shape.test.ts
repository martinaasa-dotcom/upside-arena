import { describe, expect, it } from "vitest";
import {
  dayMove,
  lastCloseBefore,
  positionedWeek,
  settledWeek,
  trailShape,
  weekSoFar,
  worthDrawing,
} from "@/lib/game/shape";

/*
  The week as five days rather than one number.

  Two things matter here. A mark has to land on the day it was actually
  recorded for, because a player who joined on the Wednesday must not be drawn
  a Monday and a Tuesday they were never in. And today's figure has to be
  marked as today's, because it is a live price and the screen says so.
*/

// A Monday, and the four days after it.
const MONDAY = "2026-08-17";
const TUESDAY = "2026-08-18";
const WEDNESDAY = "2026-08-19";
const THURSDAY = "2026-08-20";
const FRIDAY = "2026-08-21";

describe("a finished week", () => {
  it("labels the marks in the order they happened", () => {
    const days = settledWeek([1, -2, 3]);
    expect(days.map((day) => day.label)).toEqual(["Mon", "Tue", "Wed"]);
    expect(days.map((day) => day.returnPercent)).toEqual([1, -2, 3]);
  });

  it("has nothing live in it, because it is over", () => {
    expect(settledWeek([1, 2, 3, 4, 5].map(Number)).every((day) => !day.live)).toBe(true);
  });

  it("is empty for a week with no marks, rather than five blanks", () => {
    // The share card only ever shows a settled week, so no marks means there
    // is nothing to draw at all -- not a week that has not happened yet.
    expect(settledWeek([])).toEqual([]);
  });
});

describe("the week you are in the middle of", () => {
  const marks = [
    { date: MONDAY, returnPercent: 1.5 },
    { date: TUESDAY, returnPercent: -0.5 },
  ];

  it("always has five days, so the panel does not change size on Wednesday", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks,
      today: WEDNESDAY,
      liveReturnPercent: 2.25,
    });
    expect(days).toHaveLength(5);
    expect(days.map((day) => day.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  });

  it("puts each close on the date it was recorded for", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks,
      today: WEDNESDAY,
      liveReturnPercent: 2.25,
    });
    expect(days[0]).toMatchObject({ date: MONDAY, returnPercent: 1.5, live: false });
    expect(days[1]).toMatchObject({ date: TUESDAY, returnPercent: -0.5, live: false });
  });

  it("draws today from the live price, and says that is what it is", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks,
      today: WEDNESDAY,
      liveReturnPercent: 2.25,
    });
    expect(days[2]).toMatchObject({ date: WEDNESDAY, returnPercent: 2.25, live: true });
  });

  it("leaves the days that have not happened empty", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks,
      today: WEDNESDAY,
      liveReturnPercent: 2.25,
    });
    expect(days[3].returnPercent).toBeNull();
    expect(days[4].returnPercent).toBeNull();
  });

  /*
    The one that would be easy to get wrong. Somebody who joined on the
    Wednesday has one mark, and lining marks up by position rather than by
    date would hang it under Monday and claim they played a week they missed.
  */
  it("leaves a day before today empty when there is no mark for it", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks: [{ date: WEDNESDAY, returnPercent: 0.8 }],
      today: THURSDAY,
      liveReturnPercent: 1.1,
    });
    expect(days[0].returnPercent).toBeNull();
    expect(days[1].returnPercent).toBeNull();
    expect(days[2]).toMatchObject({ returnPercent: 0.8, live: false });
    expect(days[3]).toMatchObject({ returnPercent: 1.1, live: true });
  });

  /*
    After four in the afternoon the day is marked, and the two figures are the
    same number anyway. The settled one wins so the bar stops being dashed
    once the close is in the book.
  */
  it("prefers today's recorded close over the live price once it exists", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks: [...marks, { date: WEDNESDAY, returnPercent: 2.2 }],
      today: WEDNESDAY,
      liveReturnPercent: 2.25,
    });
    expect(days[2]).toMatchObject({ returnPercent: 2.2, live: false });
  });

  it("draws no live bar at the weekend, because the week is done", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks: [
        ...marks,
        { date: WEDNESDAY, returnPercent: 2.2 },
        { date: THURSDAY, returnPercent: 3 },
        { date: FRIDAY, returnPercent: 2.8 },
      ],
      today: "2026-08-22",
      liveReturnPercent: 2.8,
    });
    expect(days.every((day) => !day.live)).toBe(true);
    expect(days[4].returnPercent).toBe(2.8);
  });

  it("draws no live bar when there is no live figure to draw", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks,
      today: WEDNESDAY,
      liveReturnPercent: null,
    });
    expect(days[2].returnPercent).toBeNull();
  });
});

describe("whether it is worth drawing at all", () => {
  it("refuses a week with one bar in it", () => {
    // Monday morning: nothing settled, one live figure. A single column and
    // four gaps reads as a chart that failed rather than a week that is young.
    const days = weekSoFar({
      monday: MONDAY,
      marks: [],
      today: MONDAY,
      liveReturnPercent: 0,
    });
    expect(worthDrawing(days)).toBe(false);
  });

  it("agrees once there are two", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks: [{ date: MONDAY, returnPercent: 1 }],
      today: TUESDAY,
      liveReturnPercent: 1.4,
    });
    expect(worthDrawing(days)).toBe(true);
  });

  it("refuses a week nobody has played, live figure or not", () => {
    const days = weekSoFar({
      monday: MONDAY,
      marks: [],
      today: "2026-08-22",
      liveReturnPercent: 0,
    });
    expect(worthDrawing(days)).toBe(false);
  });
});

describe("today, as distinct from the week", () => {
  const marks = [
    { date: MONDAY, value: 101_500, returnPercent: 1.5 },
    { date: TUESDAY, value: 99_500, returnPercent: -0.5 },
  ];

  it("measures against the last close before today", () => {
    expect(lastCloseBefore(marks, WEDNESDAY)?.date).toBe(TUESDAY);
  });

  /*
    The one that would quietly report every evening as a day on which
    nothing happened. After four in the afternoon today's own close is in
    the book, and measuring today against itself gives zero for ever.
  */
  it("ignores today's own close once it has been recorded", () => {
    const withToday = [...marks, { date: WEDNESDAY, value: 102_000, returnPercent: 2 }];
    expect(lastCloseBefore(withToday, WEDNESDAY)?.date).toBe(TUESDAY);
  });

  it("has nothing to measure against on the first day of a week", () => {
    expect(lastCloseBefore([], MONDAY)).toBeNull();
    expect(dayMove(100_000, null)).toBeNull();
  });

  it("is the move since last night, in money and in percent", () => {
    // Closed at 99,500 and is worth 100,495 now: up 995, which is one per
    // cent of last night rather than of the hundred thousand it started on.
    const move = dayMove(100_495, marks[1]);
    expect(move?.amount).toBeCloseTo(995, 9);
    expect(move?.percent).toBeCloseTo(1, 9);
  });

  /*
    Why it is not the difference of the two weekly figures. Those are both
    against the starting balance, so subtracting them answers "how much of
    the starting balance did today move", which is a different and smaller
    number -- here 1.0% against 0.995 percentage points. Small, and wrong,
    and it grows with the size of the gap.
  */
  it("is against last night's value, not against what the week started with", () => {
    const move = dayMove(100_495, marks[1]);
    const naive = 0.495 - -0.5;
    expect(move?.percent).not.toBeCloseTo(naive, 6);
    expect(move?.percent).toBeCloseTo(1, 9);
  });

  it("goes down as well", () => {
    const move = dayMove(97_510, marks[1]);
    expect(move?.amount).toBeCloseTo(-1990, 9);
    expect(move?.percent).toBeCloseTo(-2, 9);
  });

  it("refuses to divide by a close of nothing", () => {
    expect(dayMove(100, { date: MONDAY, value: 0, returnPercent: -100 })).toBeNull();
  });
});

describe("laying a finished week out on its days", () => {
  /*
    The bug this exists for. The share card held its closes as a list and
    drew the first one under Monday, so somebody who signed up on the
    Wednesday had their Wednesday, Thursday and Friday shown as Monday,
    Tuesday and Wednesday -- on the one artefact in the whole product that
    other people see, and to exactly the player most likely to post one.
  */
  it("puts a midweek joiner's first day under the day it was", () => {
    const week = positionedWeek(MONDAY, [
      { date: WEDNESDAY, value: 101_000, returnPercent: 1 },
      { date: THURSDAY, value: 102_000, returnPercent: 2 },
      { date: FRIDAY, value: 103_000, returnPercent: 3 },
    ]);
    expect(week).toEqual([null, null, 1, 2, 3]);
  });

  it("is five days whatever it holds", () => {
    expect(positionedWeek(MONDAY, [])).toEqual([null, null, null, null, null]);
    expect(positionedWeek(MONDAY, [{ date: FRIDAY, value: 1, returnPercent: 9 }])).toHaveLength(5);
  });

  it("lays a full week out in order", () => {
    const week = positionedWeek(MONDAY, [
      { date: MONDAY, value: 1, returnPercent: 1 },
      { date: TUESDAY, value: 2, returnPercent: -2 },
      { date: WEDNESDAY, value: 3, returnPercent: 3 },
      { date: THURSDAY, value: 4, returnPercent: -4 },
      { date: FRIDAY, value: 5, returnPercent: 5 },
    ]);
    expect(week).toEqual([1, -2, 3, -4, 5]);
  });

  it("ignores a close that does not belong to the week", () => {
    // A mark from the following Monday is not this week's fifth day.
    const week = positionedWeek(MONDAY, [
      { date: MONDAY, value: 1, returnPercent: 1 },
      { date: "2026-08-24", value: 2, returnPercent: 99 },
    ]);
    expect(week).toEqual([1, null, null, null, null]);
  });

  it("hands the drawn week the same holes", () => {
    const days = settledWeek(positionedWeek(MONDAY, [
      { date: THURSDAY, value: 1, returnPercent: 4 },
    ]));
    expect(days.map((day) => day.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(days[3].returnPercent).toBe(4);
    expect(days[0].returnPercent).toBeNull();
  });
});

describe("a long contest as a line", () => {
  it("needs somewhere to go", () => {
    // One close is a figure, not a trajectory.
    expect(trailShape([], 100, 50)).toBeNull();
    expect(trailShape([3], 100, 50)).toBeNull();
  });

  it("spans the box it is given", () => {
    const shape = trailShape([0, 5], 100, 50);
    expect(shape?.aheadLine).toBe("M0.00,50.00L100.00,0.00");
    expect(shape?.endX).toBeCloseTo(100, 9);
  });

  it("spaces points evenly however many there are", () => {
    const shape = trailShape([0, 1, 2, 3, 4], 100, 50);
    // Four gaps across a hundred: every twenty-five.
    expect(shape?.aheadLine).toContain("25.00,");
    expect(shape?.aheadLine).toContain("50.00,");
    expect(shape?.aheadLine).toContain("75.00,");
  });

  /*
    The one that decides whether the picture is honest. Scaled between its
    own best and worst day, a run that only ever gained would look exactly
    like one that only ever lost -- both a line from the floor to the
    ceiling. Zero is always in the scale, so a run that never went below
    what it started with sits entirely above the line.
  */
  it("always has what you started with somewhere in the box", () => {
    expect(trailShape([1, 2, 3], 100, 60)?.zeroY).toBeCloseTo(60, 9);
    expect(trailShape([-1, -2, -3], 100, 60)?.zeroY).toBeCloseTo(0, 9);
    expect(trailShape([-5, 0, 5], 100, 60)?.zeroY).toBeCloseTo(30, 9);
  });

  it("draws a run that only gained as ahead, and nothing as behind", () => {
    const shape = trailShape([1, 2, 3], 100, 60);
    expect(shape?.aheadLine).not.toBe("");
    expect(shape?.behindLine).toBe("");
    expect(shape?.behindArea).toBe("");
  });

  it("draws a run that only lost as behind, and nothing as ahead", () => {
    const shape = trailShape([-1, -2, -3], 100, 60);
    expect(shape?.behindLine).not.toBe("");
    expect(shape?.aheadLine).toBe("");
  });

  /*
    The bug this was rewritten for. A quarter that climbed to sixteen and
    came back to just under nothing was drawn entirely in the losing colour,
    because the colour came from where it ended -- three months of being well
    above the line, painted in the colour that means below it.
  */
  it("colours a run by where it was, not by where it ended", () => {
    const shape = trailShape([1, 16, 12, -0.5], 100, 60);
    expect(shape?.aheadLine).not.toBe("");
    expect(shape?.behindLine).not.toBe("");
  });

  it("cuts at the crossing rather than at the nearest close", () => {
    // From +2 to -2 across a hundred wide box: it crosses halfway.
    const shape = trailShape([2, -2], 100, 60);
    expect(shape?.aheadLine).toContain("50.00,");
    expect(shape?.behindLine).toContain("50.00,");
  });

  it("meets at the crossing rather than leaving a gap", () => {
    // Both sides own the crossing point, so the two lines touch.
    const shape = trailShape([4, -4], 100, 60);
    expect(shape?.aheadLine.endsWith(`50.00,${shape?.zeroY.toFixed(2)}`)).toBe(true);
    expect(shape?.behindLine.startsWith(`M50.00,${shape?.zeroY.toFixed(2)}`)).toBe(true);
  });

  it("closes each fill down to the line rather than to the floor", () => {
    // Otherwise a losing run is shaded from its own worst point up to the
    // bottom of the box, which is a block of colour meaning nothing.
    const shape = trailShape([-1, -3], 100, 60);
    expect(shape?.behindArea.endsWith(`L100.00,${shape?.zeroY.toFixed(2)}Z`)).toBe(true);
  });

  it("does not divide by nothing when a run never moved", () => {
    const shape = trailShape([0, 0, 0], 100, 60);
    expect(shape).not.toBeNull();
    expect(shape?.aheadLine).not.toContain("NaN");
    expect(shape?.behindArea).not.toContain("NaN");
  });

  it("ends on the last point, which is where it is now", () => {
    const shape = trailShape([0, 10, 4], 100, 60);
    expect(shape?.endX).toBeCloseTo(100, 9);
    // Ten is the top, zero the bottom of a ten-point span: four is 60% down.
    expect(shape?.endY).toBeCloseTo(36, 9);
  });
});
