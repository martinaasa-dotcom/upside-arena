import { describe, expect, it } from "vitest";
import {
  cycleMonday,
  isTradingDay,
  isTradingOpen,
  isWeekend,
  lineupLocked,
  lineupMonday,
  lineupReady,
  nyDate,
  previousTradingDay,
  sessionLabel,
  sessionMark,
  tradingDaysBetween,
} from "@/lib/market/session";

/*
  A week runs Monday's open to Friday's close in New York, whatever timezone
  the player is in. Getting this wrong by an hour would put trades in the wrong
  week, so the boundaries are pinned here.
*/

// Times are given in UTC. New York is UTC-4 in summer, UTC-5 in winter.
const at = (iso: string) => new Date(iso);

describe("cycleMonday", () => {
  it("maps a weekday to the Monday of its own week", () => {
    expect(cycleMonday(at("2026-08-19T15:00:00Z"))).toBe("2026-08-17"); // Wed
    expect(cycleMonday(at("2026-08-21T15:00:00Z"))).toBe("2026-08-17"); // Fri
    expect(cycleMonday(at("2026-08-17T15:00:00Z"))).toBe("2026-08-17"); // Mon
  });

  it("puts the weekend in the week about to start, not the one just finished", () => {
    // Someone joining on Saturday should land in the upcoming race, not a
    // week whose result is already settled.
    expect(cycleMonday(at("2026-08-22T15:00:00Z"))).toBe("2026-08-24"); // Sat
    expect(cycleMonday(at("2026-08-23T15:00:00Z"))).toBe("2026-08-24"); // Sun
  });

  it("uses the New York day, not the caller's", () => {
    // 01:00 UTC Monday is still Sunday evening in New York, so this belongs
    // to the week starting that same Monday.
    expect(cycleMonday(at("2026-08-24T01:00:00Z"))).toBe("2026-08-24");
    // 23:00 UTC Friday is Friday evening in New York: same week.
    expect(cycleMonday(at("2026-08-21T23:00:00Z"))).toBe("2026-08-17");
    // 02:00 UTC Saturday is Friday evening in New York, still that week.
    expect(cycleMonday(at("2026-08-22T02:00:00Z"))).toBe("2026-08-17");
  });

  it("crosses a daylight saving change without slipping a day", () => {
    // US clocks go back on 1 November 2026.
    expect(cycleMonday(at("2026-10-30T15:00:00Z"))).toBe("2026-10-26"); // Fri before
    expect(cycleMonday(at("2026-11-04T15:00:00Z"))).toBe("2026-11-02"); // Wed after
    // And forward on 8 March 2026.
    expect(cycleMonday(at("2026-03-06T15:00:00Z"))).toBe("2026-03-02");
    expect(cycleMonday(at("2026-03-11T15:00:00Z"))).toBe("2026-03-09");
  });

  it("always returns a Monday", () => {
    for (let day = 0; day < 40; day++) {
      const when = new Date(Date.UTC(2026, 7, 1 + day, 14));
      const monday = new Date(`${cycleMonday(when)}T12:00:00Z`);
      expect(monday.getUTCDay()).toBe(1);
    }
  });
});

describe("nyDate", () => {
  it("reports the New York calendar day", () => {
    expect(nyDate(at("2026-08-21T15:00:00Z"))).toBe("2026-08-21");
    // Just past midnight UTC is still the previous evening in New York.
    expect(nyDate(at("2026-08-22T01:00:00Z"))).toBe("2026-08-21");
  });
});

describe("isWeekend", () => {
  it("follows the New York weekend", () => {
    expect(isWeekend(at("2026-08-22T15:00:00Z"))).toBe(true);
    expect(isWeekend(at("2026-08-23T15:00:00Z"))).toBe(true);
    expect(isWeekend(at("2026-08-21T15:00:00Z"))).toBe(false);
    // Saturday 02:00 UTC is Friday evening in New York, so not the weekend.
    expect(isWeekend(at("2026-08-22T02:00:00Z"))).toBe(false);
  });
});

describe("isTradingOpen", () => {
  it("is open during the regular session on a weekday", () => {
    // 14:00 UTC is 10:00 in New York during summer.
    expect(isTradingOpen(at("2026-08-19T14:00:00Z"))).toBe(true);
    expect(isTradingOpen(at("2026-08-19T19:59:00Z"))).toBe(true);
  });

  it("is shut before the open and after the close", () => {
    // 13:29 UTC is 09:29 in New York, one minute early.
    expect(isTradingOpen(at("2026-08-19T13:29:00Z"))).toBe(false);
    expect(isTradingOpen(at("2026-08-19T13:30:00Z"))).toBe(true);
    // 20:00 UTC is 16:00, the close itself.
    expect(isTradingOpen(at("2026-08-19T20:00:00Z"))).toBe(false);
  });

  it("is shut all weekend", () => {
    expect(isTradingOpen(at("2026-08-22T14:00:00Z"))).toBe(false);
    expect(isTradingOpen(at("2026-08-23T14:00:00Z"))).toBe(false);
  });

  it("follows the clock change rather than a fixed UTC offset", () => {
    // In winter New York is UTC-5, so the open is 14:30 UTC, not 13:30.
    expect(isTradingOpen(at("2026-12-16T13:30:00Z"))).toBe(false);
    expect(isTradingOpen(at("2026-12-16T14:30:00Z"))).toBe(true);
  });
});

describe("sessionMark", () => {
  it("uses the regular price and the previous close while the market is open", () => {
    expect(
      sessionMark({
        marketState: "REGULAR",
        regularPrice: 311,
        postPrice: null,
        prePrice: null,
        previousClose: 305,
      })
    ).toEqual({ price: 311, previousClose: 305 });
  });

  it("prefers the after-hours print once the session has ended", () => {
    expect(
      sessionMark({
        marketState: "POST",
        regularPrice: 311,
        postPrice: 314,
        prePrice: null,
        previousClose: 305,
      })
    ).toEqual({ price: 314, previousClose: 305 });
  });

  it("measures pre-market against yesterday's close, not the day before", () => {
    // Before the open, the regular price is still yesterday's close, so that
    // is the right baseline.
    expect(
      sessionMark({
        marketState: "PRE",
        regularPrice: 311,
        postPrice: null,
        prePrice: 316,
        previousClose: 305,
      })
    ).toEqual({ price: 316, previousClose: 311 });
  });

  it("does not show a flat day when the feed copies the live mark into the close", () => {
    // Yahoo sometimes reports previousClose as the live price overnight. Taken
    // at face value that shows every holding as unchanged.
    const result = sessionMark({
      marketState: "CLOSED",
      regularPrice: 305,
      postPrice: null,
      prePrice: null,
      previousClose: 311,
    });
    expect(result.price).toBe(305);
    expect(result.previousClose).not.toBe(305);
  });

  it("survives a feed with nothing useful in it", () => {
    expect(
      sessionMark({
        marketState: null,
        regularPrice: null,
        postPrice: null,
        prePrice: null,
        previousClose: null,
      })
    ).toEqual({ price: 0, previousClose: 0 });
  });
});

describe("sessionLabel", () => {
  it("says it in plain words, with no market jargon", () => {
    expect(sessionLabel("REGULAR")).toBe("Market open");
    expect(sessionLabel("PRE")).toBe("Before the open");
    expect(sessionLabel("POST")).toBe("After the close");
    expect(sessionLabel("CLOSED")).toBe("Market closed");
    expect(sessionLabel(null)).toBe("Market closed");
  });
});

describe("trading days", () => {
  it("knows a weekday from a weekend", () => {
    expect(isTradingDay("2026-08-21")).toBe(true); // Friday
    expect(isTradingDay("2026-08-22")).toBe(false); // Saturday
    expect(isTradingDay("2026-08-23")).toBe(false); // Sunday
    expect(isTradingDay("2026-08-24")).toBe(true); // Monday
  });

  it("steps back over a weekend to the previous trading day", () => {
    expect(previousTradingDay("2026-08-24")).toBe("2026-08-21"); // Mon to Fri
    expect(previousTradingDay("2026-08-21")).toBe("2026-08-20"); // Fri to Thu
    expect(previousTradingDay("2026-08-22")).toBe("2026-08-21"); // Sat to Fri
  });

  it("counts nothing missed across a normal weekend", () => {
    // Friday to Monday is a weekend, not a missed day. Counting it would end
    // every streak every week.
    expect(tradingDaysBetween("2026-08-21", "2026-08-24")).toBe(0);
  });

  it("counts nothing missed on consecutive weekdays", () => {
    expect(tradingDaysBetween("2026-08-19", "2026-08-20")).toBe(0);
  });

  it("counts the weekdays actually skipped", () => {
    // Monday to Thursday skips Tuesday and Wednesday.
    expect(tradingDaysBetween("2026-08-17", "2026-08-20")).toBe(2);
    // Friday to the following Wednesday skips Monday and Tuesday.
    expect(tradingDaysBetween("2026-08-21", "2026-08-26")).toBe(2);
  });

  it("counts a fortnight away as ten missed days, not fourteen", () => {
    expect(tradingDaysBetween("2026-08-03", "2026-08-18")).toBe(10);
  });

  it("treats a date at or before itself as nothing missed", () => {
    expect(tradingDaysBetween("2026-08-20", "2026-08-20")).toBe(0);
    expect(tradingDaysBetween("2026-08-21", "2026-08-20")).toBe(0);
  });
});

/*
  The lineup clock.

  The whole fairness of a lineup is one comparison: is Monday's opening price
  known yet? Before the bell nobody knows it, so an order may still be changed.
  From the bell it exists, and an order that could still be changed would be a
  trade placed with hindsight. These are that comparison.
*/
describe("lineupLocked", () => {
  const MONDAY = "2026-08-24";

  it("is open all weekend before it", () => {
    expect(lineupLocked(MONDAY, at("2026-08-22T15:00:00Z"))).toBe(false); // Sat
    expect(lineupLocked(MONDAY, at("2026-08-23T23:00:00Z"))).toBe(false); // Sun
  });

  it("is open on the Monday morning until the bell", () => {
    // 13:00 UTC is 09:00 in New York in August. Half an hour to go.
    expect(lineupLocked(MONDAY, at("2026-08-24T13:00:00Z"))).toBe(false);
  });

  it("locks at the bell, not at midnight", () => {
    // 13:30 UTC is 09:30 in New York in August.
    expect(lineupLocked(MONDAY, at("2026-08-24T13:30:00Z"))).toBe(true);
    expect(lineupLocked(MONDAY, at("2026-08-24T18:00:00Z"))).toBe(true);
  });

  it("stays locked for the rest of the week", () => {
    expect(lineupLocked(MONDAY, at("2026-08-26T15:00:00Z"))).toBe(true);
    expect(lineupLocked(MONDAY, at("2026-08-28T15:00:00Z"))).toBe(true);
  });
});

describe("lineupMonday", () => {
  it("is the Monday about to arrive, at the weekend", () => {
    expect(lineupMonday(at("2026-08-22T15:00:00Z"))).toBe("2026-08-24"); // Sat
    expect(lineupMonday(at("2026-08-23T15:00:00Z"))).toBe("2026-08-24"); // Sun
  });

  it("is still this Monday before the bell on it", () => {
    expect(lineupMonday(at("2026-08-24T13:00:00Z"))).toBe("2026-08-24");
  });

  /*
    Once this week's opening price exists, the earliest week whose does not is
    the next one. A lineup queued on a Wednesday is for the Monday after.
  */
  it("rolls to next Monday once this week has opened", () => {
    expect(lineupMonday(at("2026-08-24T13:30:00Z"))).toBe("2026-08-31");
    expect(lineupMonday(at("2026-08-26T15:00:00Z"))).toBe("2026-08-31");
    expect(lineupMonday(at("2026-08-28T21:00:00Z"))).toBe("2026-08-31");
  });

  it("crosses a month boundary without drifting", () => {
    expect(lineupMonday(at("2026-08-29T15:00:00Z"))).toBe("2026-08-31");
    expect(lineupMonday(at("2026-09-02T15:00:00Z"))).toBe("2026-09-07");
  });
});

describe("lineupReady", () => {
  const MONDAY = "2026-08-24";

  it("waits for the bell", () => {
    expect(lineupReady(MONDAY, at("2026-08-24T13:00:00Z"))).toBe(false);
    expect(lineupReady(MONDAY, at("2026-08-23T15:00:00Z"))).toBe(false);
  });

  /*
    And then waits a further half hour. The daily bar an opening price is read
    from arrives a few minutes into the session, so filling at 09:30:20 would
    record "we had no opening price" for a name that had one perfectly well by
    09:35 -- and that is written into somebody's week and cannot be undone.
  */
  it("waits half an hour past it, so the opening price exists to be read", () => {
    expect(lineupReady(MONDAY, at("2026-08-24T13:35:00Z"))).toBe(false);
    expect(lineupReady(MONDAY, at("2026-08-24T14:00:00Z"))).toBe(true);
  });

  it("is ready any time later in the week", () => {
    // Somebody who did not open Arena until Wednesday still fills at Monday's
    // open, so there is nothing to wait for.
    expect(lineupReady(MONDAY, at("2026-08-26T02:00:00Z"))).toBe(true);
  });
});
