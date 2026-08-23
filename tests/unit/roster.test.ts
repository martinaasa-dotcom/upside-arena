import { describe, expect, it } from "vitest";
import { whoWasHere } from "@/lib/game/roster";

/*
  Who was in a league while a contest was running.

  Three rooms ask this -- the weekly winners, the head-to-head, and the reveal
  of what everybody held -- and they have to agree, because they sit within
  two inches of each other on one page.

  It was written out twice, and the second copy did not ask it at all. A
  portfolio belongs to a person and a cycle rather than to a league, so
  somebody who played a week on their own and joined the league afterwards had
  a book from a week they were not in it for.
*/

// Friday. The last trade of a market-hours week is at 16:00 New York, which
// is 20:00 UTC while daylight saving is in effect.
const ENDS = "2026-08-21";

const at = (iso: string) => iso;

describe("who was in the league for a contest", () => {
  it("counts somebody who joined before it started", () => {
    expect(whoWasHere([{ userId: "u1", joinedAt: at("2026-08-10T09:00:00Z") }], ENDS)).toEqual(
      new Set(["u1"])
    );
  });

  it("counts somebody who joined during it", () => {
    expect(whoWasHere([{ userId: "u1", joinedAt: at("2026-08-19T14:00:00Z") }], ENDS)).toEqual(
      new Set(["u1"])
    );
  });

  it("leaves out somebody who joined the week after", () => {
    expect(whoWasHere([{ userId: "u1", joinedAt: at("2026-08-24T13:00:00Z") }], ENDS)).toEqual(
      new Set()
    );
  });

  /*
    The evening the two wrong answers disagree about. Nine at night in New
    York on the final Friday is after the close, so that person did not play
    the week -- but the calendar date is still the Friday, and in UTC it is
    already Saturday.
  */
  it("leaves out somebody who joined after the final close", () => {
    // 21:00 in New York on the Friday.
    expect(whoWasHere([{ userId: "u1", joinedAt: at("2026-08-22T01:00:00Z") }], ENDS)).toEqual(
      new Set()
    );
  });

  it("counts somebody who joined that morning", () => {
    // 10:00 in New York on the Friday, while it was still being played.
    expect(whoWasHere([{ userId: "u1", joinedAt: at("2026-08-21T14:00:00Z") }], ENDS)).toEqual(
      new Set(["u1"])
    );
  });

  it("counts the whole of the last day for a market that never shuts", () => {
    const late = [{ userId: "u1", joinedAt: at("2026-08-22T01:00:00Z") }];
    expect(whoWasHere(late, ENDS, true)).toEqual(new Set(["u1"]));
    expect(whoWasHere(late, ENDS, false)).toEqual(new Set());
  });

  it("keeps everybody who qualifies and only them", () => {
    const roster = [
      { userId: "early", joinedAt: at("2026-08-01T00:00:00Z") },
      { userId: "during", joinedAt: at("2026-08-19T15:00:00Z") },
      { userId: "after", joinedAt: at("2026-08-25T15:00:00Z") },
    ];
    expect(whoWasHere(roster, ENDS)).toEqual(new Set(["early", "during"]));
  });

  it("drops a timestamp it cannot read rather than admitting it", () => {
    // A row nobody can date is a row that cannot be shown to have been there,
    // and guessing in their favour would put a stranger in somebody's league.
    expect(whoWasHere([{ userId: "u1", joinedAt: "not a date" }], ENDS)).toEqual(new Set());
  });

  it("has nobody in it when the roster is empty", () => {
    expect(whoWasHere([], ENDS)).toEqual(new Set());
  });
});
