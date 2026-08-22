import { describe, expect, it } from "vitest";
import {
  LENGTHS,
  daysBetween,
  hasEnded,
  isLengthId,
  lengthById,
  runEndsOn,
  runStartsOn,
  timeLeft,
} from "@/lib/game/lengths";

/*
  When a contest starts and when it is settled.

  These dates are the whole of what a length means: the database claims a
  cycle for scoring on the day after ends_on, so an end date one day out is a
  battle settled on the wrong prices, and there is no fixing that afterwards.
*/

// A known week, so the weekday arithmetic is checked against a real calendar
// rather than against itself. 2026-03-02 is a Monday.
const MON = "2026-03-02";
const TUE = "2026-03-03";
const THU = "2026-03-05";
const FRI = "2026-03-06";
const SAT = "2026-03-07";
const SUN = "2026-03-08";
const NEXT_MON = "2026-03-09";
const NEXT_FRI = "2026-03-13";

describe("the catalogue", () => {
  it("uses each id once and finds each one back", () => {
    const ids = LENGTHS.map((length) => length.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const length of LENGTHS) expect(lengthById(length.id)).toBe(length);
  });

  it("falls back to a week on an id it does not know", () => {
    expect(lengthById("decade").id).toBe("week");
    expect(lengthById(null).id).toBe("week");
    expect(isLengthId("decade")).toBe(false);
    expect(isLengthId("fortnight")).toBe(true);
  });
});

describe("when a contest starts", () => {
  it("starts today on a weekday", () => {
    expect(runStartsOn(MON)).toBe(MON);
    expect(runStartsOn(THU)).toBe(THU);
    expect(runStartsOn(FRI)).toBe(FRI);
  });

  /*
    The weekend belongs to the week about to begin, not the one that just
    finished -- the same rule the weekly cycle uses. Nothing moves at the
    weekend, so a one-day battle "started" on Sunday would have spent its
    whole run shut.
  */
  it("waits for Monday when it is started at the weekend", () => {
    expect(runStartsOn(SAT)).toBe(NEXT_MON);
    expect(runStartsOn(SUN)).toBe(NEXT_MON);
  });
});

describe("when it is settled", () => {
  it("settles a one-day battle at that day's close", () => {
    expect(runEndsOn(TUE, "day")).toBe(TUE);
    expect(runEndsOn(SAT, "day")).toBe(NEXT_MON);
  });

  it("settles everything else at a Friday close", () => {
    expect(runEndsOn(MON, "week")).toBe(FRI);
    expect(runEndsOn(TUE, "week")).toBe(FRI);
    expect(runEndsOn(THU, "week")).toBe(FRI);
  });

  /*
    A week needs at least two days in it to be a week. Started on a Friday
    afternoon it would otherwise be scored at that afternoon's close, which is
    not a game, it is a rounding error with a scoreboard.
  */
  it("gives a battle started on a Friday the week after", () => {
    expect(runEndsOn(FRI, "week")).toBe(NEXT_FRI);
  });

  it("starts the weekend's battles on Monday and ends them on a Friday", () => {
    expect(runEndsOn(SAT, "week")).toBe(NEXT_FRI);
    expect(runEndsOn(SUN, "week")).toBe(NEXT_FRI);
  });

  it("counts the longer lengths in whole weeks from that first Friday", () => {
    expect(runEndsOn(MON, "fortnight")).toBe("2026-03-13");
    expect(runEndsOn(MON, "month")).toBe("2026-03-27");
    expect(runEndsOn(MON, "quarter")).toBe("2026-05-29");
    expect(runEndsOn(MON, "year")).toBe("2027-02-26");
  });

  it("always ends on a Friday, whatever the length and whatever the start", () => {
    for (const start of [MON, TUE, THU, FRI, SAT, SUN]) {
      for (const length of LENGTHS) {
        if (length.weeks === 0) continue;
        const end = runEndsOn(start, length.id);
        expect(
          new Date(`${end}T12:00:00Z`).getUTCDay(),
          `${start} + ${length.id} = ${end}`
        ).toBe(5);
      }
    }
  });

  it("never ends before it starts", () => {
    for (const start of [MON, TUE, THU, FRI, SAT, SUN]) {
      for (const length of LENGTHS) {
        expect(runEndsOn(start, length.id) >= runStartsOn(start)).toBe(true);
      }
    }
  });

  it("crosses a month, a year and a daylight-saving change without drifting", () => {
    // The clocks go forward in New York on 2026-03-08, inside this fortnight.
    expect(runEndsOn("2026-03-02", "fortnight")).toBe("2026-03-13");
    // And back on 2026-11-01.
    expect(runEndsOn("2026-10-26", "fortnight")).toBe("2026-11-06");
    expect(runEndsOn("2026-12-28", "fortnight")).toBe("2027-01-08");
  });
});

describe("how long is left", () => {
  it("counts calendar days between two dates", () => {
    expect(daysBetween(MON, FRI)).toBe(4);
    expect(daysBetween(FRI, MON)).toBe(-4);
    expect(daysBetween(MON, MON)).toBe(0);
  });

  it("knows when a contest is over, on the day after its last one", () => {
    expect(hasEnded(FRI, FRI)).toBe(false);
    expect(hasEnded(FRI, SAT)).toBe(true);
  });

  it("says it in words somebody can act on", () => {
    expect(timeLeft(MON, MON)).toBe("Ends at tonight's close");
    expect(timeLeft(TUE, MON)).toBe("Ends at tomorrow's close");
    expect(timeLeft(FRI, MON)).toBe("4 days left");
    expect(timeLeft(MON, TUE)).toBe("Finished");
  });

  /*
    Vague on purpose past a fortnight. "Ends in 46 days" is a number nobody
    can do anything with, and a countdown on something three months out is
    manufactured urgency.
  */
  it("goes vague on the long ones rather than counting down at somebody", () => {
    expect(timeLeft("2026-05-29", MON)).toMatch(/^About \d+ months left$/);
    expect(timeLeft("2026-04-10", MON)).toMatch(/^About \d+ weeks left$/);
  });
});
