import { describe, expect, it } from "vitest";
import { settledWeek, weekSoFar, worthDrawing } from "@/lib/game/shape";

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
