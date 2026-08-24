import { describe, expect, it } from "vitest";
import {
  isMarketHoliday,
  isTradingDay,
  isTradingOpen,
  lineupReady,
  nextSessionOnOrAfter,
  previousTradingDay,
  tradingDaysBetween,
  tradingDaysSoFarThisWeek,
} from "@/lib/market/session";

/*
  The days the market is shut and the calendar does not say so.

  A streak counts days the market was open. Until the calendar was here, a
  holiday counted as an open day, which meant somebody who looked in on the
  Wednesday, spent Thanksgiving away from a screen and came back on the Friday
  had a day counted against them for not opening a game whose market was shut.

  Every date below was checked against the exchange's published calendar
  rather than derived from the code, which is the only way a test of a
  calendar is worth anything.
*/

describe("the holidays themselves", () => {
  const holidays2026 = [
    ["2026-01-01", "New Year's Day, a Thursday"],
    ["2026-01-19", "Martin Luther King Jr Day, the third Monday"],
    ["2026-02-16", "Washington's Birthday, the third Monday"],
    ["2026-04-03", "Good Friday, two days before Easter on the fifth"],
    ["2026-05-25", "Memorial Day, the last Monday of May"],
    ["2026-06-19", "Juneteenth, a Friday"],
    ["2026-07-03", "Independence Day, kept on the Friday because the fourth is a Saturday"],
    ["2026-09-07", "Labor Day, the first Monday"],
    ["2026-11-26", "Thanksgiving, the fourth Thursday"],
    ["2026-12-25", "Christmas Day, a Friday"],
  ] as const;

  it.each(holidays2026)("%s is shut: %s", (date) => {
    expect(isMarketHoliday(date)).toBe(true);
    expect(isTradingDay(date)).toBe(false);
  });

  it("keeps an ordinary day ordinary", () => {
    for (const day of ["2026-07-06", "2026-11-25", "2026-11-27", "2026-12-24"]) {
      expect(isMarketHoliday(day), day).toBe(false);
    }
  });

  it("moves a Sunday holiday to the Monday after", () => {
    // Christmas 2022 fell on a Sunday and the exchange shut on the Monday.
    expect(isMarketHoliday("2022-12-26")).toBe(true);
    expect(isMarketHoliday("2022-12-25")).toBe(false);
  });

  it("moves a Saturday holiday to the Friday before", () => {
    // Christmas 2027 falls on a Saturday.
    expect(isMarketHoliday("2027-12-24")).toBe(true);
  });

  it("does not move New Year's Day off a Saturday, because the exchange does not", () => {
    // 1 January 2028 is a Saturday. The Friday before it belongs to the year
    // that has just ended and the market is open on it.
    expect(isMarketHoliday("2027-12-31")).toBe(false);
    expect(isMarketHoliday("2028-01-03")).toBe(false);
  });

  it("finds Good Friday in years whose Easter is nowhere near the last one", () => {
    expect(isMarketHoliday("2024-03-29")).toBe(true); // Easter 31 March
    expect(isMarketHoliday("2025-04-18")).toBe(true); // Easter 20 April
    expect(isMarketHoliday("2027-03-26")).toBe(true); // Easter 28 March
  });
});

describe("what the rest of the app asks", () => {
  it("does not count a holiday as a day somebody missed", () => {
    // Wednesday to Friday over Thanksgiving 2026. The Thursday was shut, so
    // nothing was missed, and a streak survives without spending a freeze.
    expect(tradingDaysBetween("2026-11-25", "2026-11-27")).toBe(0);
  });

  it("still counts an ordinary weekday somebody missed", () => {
    expect(tradingDaysBetween("2026-11-23", "2026-11-25")).toBe(1);
  });

  it("steps back over a holiday to find the day before", () => {
    expect(previousTradingDay("2026-11-27")).toBe("2026-11-25");
    expect(previousTradingDay("2026-07-06")).toBe("2026-07-02");
  });

  it("knows a week with a holiday in it is a shorter week", () => {
    // Friday of Thanksgiving week 2026: Monday to Friday is five days on the
    // calendar and four with the market open.
    expect(tradingDaysSoFarThisWeek(new Date("2026-11-27T18:00:00Z"))).toBe(4);
  });

  it("counts an ordinary week the ordinary way", () => {
    expect(tradingDaysSoFarThisWeek(new Date("2026-11-20T18:00:00Z"))).toBe(5);
    expect(tradingDaysSoFarThisWeek(new Date("2026-11-17T18:00:00Z"))).toBe(2);
  });

  it("counts the week that has just finished at a weekend", () => {
    // Saturday of Independence Day week 2026, whose Friday was the holiday.
    expect(tradingDaysSoFarThisWeek(new Date("2026-07-04T18:00:00Z"))).toBe(4);
  });
});

describe("what a shut day means for the game", () => {
  it("takes no trade on a holiday, whatever the clock says", () => {
    /*
      14:30 UTC is 10:30 in New York, the middle of a session on any ordinary
      day. On Martin Luther King Jr Day the market is shut, and a trade filled
      then would fill at Friday's close with three days of news already known,
      which is the one thing a paper game must never sell.
    */
    expect(isTradingOpen(new Date("2027-01-18T15:30:00Z"))).toBe(false);
    // The Tuesday after it, at the same hour, is an ordinary morning.
    expect(isTradingOpen(new Date("2027-01-19T15:30:00Z"))).toBe(true);
  });

  it("finds the first day a week actually trades", () => {
    // Memorial Day 2026 is the Monday of its week.
    expect(nextSessionOnOrAfter("2026-05-25")).toBe("2026-05-26");
    expect(nextSessionOnOrAfter("2026-05-18")).toBe("2026-05-18");
  });

  it("does not run a lineup at a session that does not exist", () => {
    /*
      Three Mondays a year are holidays. The fill used to run at 10:00 on the
      Monday regardless, against an opening price that was never printed, and
      every order queued for such a week came back as "we had no opening price
      for that morning": a lineup thrown away silently, which is the one thing
      the feature promised not to do.
    */
    expect(lineupReady("2026-05-25", new Date("2026-05-25T14:30:00Z"))).toBe(false);
    // 14:00 UTC on the Tuesday is 10:00 in New York, half an hour in.
    expect(lineupReady("2026-05-25", new Date("2026-05-26T14:00:00Z"))).toBe(true);
  });

  it("still runs it at ten on an ordinary Monday", () => {
    expect(lineupReady("2026-05-18", new Date("2026-05-18T14:00:00Z"))).toBe(true);
    expect(lineupReady("2026-05-18", new Date("2026-05-18T13:00:00Z"))).toBe(false);
  });
});
