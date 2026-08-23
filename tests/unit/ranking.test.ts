import { describe, expect, it } from "vitest";
import { byResult, compareResults } from "@/lib/game/ranking";

/*
  The order a field is shown in.

  Seven places used to do this with the same expression and no tie-break, and
  a tie is not the rare case it sounds like: everybody who never trades
  finishes at exactly their starting balance, so in a league of six where
  three people were busy, three of them are level at precisely nought.

  With no tie-break, a stable sort keeps whatever order the rows arrived in --
  which is whatever the query returned. So the room and the job that sends
  "you finished fifth of six" could read the same three people in different
  orders, and one of them is told a placing their league's table does not
  show.
*/

const p = (userId: string, returnPercent: number) => ({ userId, returnPercent });

describe("ordering a field", () => {
  it("puts the best return first", () => {
    const order = byResult([p("a", -1), p("b", 4.2), p("c", 0.5)]);
    expect(order.map((row) => row.userId)).toEqual(["b", "c", "a"]);
  });

  /*
    The whole point. Two identical fields in different orders have to come out
    the same way round, because they are the same league being read by two
    different screens.
  */
  it("puts level players in the same order however they arrived", () => {
    const one = byResult([p("zoe", 0), p("adam", 0), p("mia", 0)]);
    const other = byResult([p("mia", 0), p("zoe", 0), p("adam", 0)]);
    expect(one.map((row) => row.userId)).toEqual(other.map((row) => row.userId));
  });

  it("keeps the return ahead of the tie-break", () => {
    // "adam" sorts before "zoe", but only among people who are level.
    const order = byResult([p("adam", 1), p("zoe", 9)]);
    expect(order.map((row) => row.userId)).toEqual(["zoe", "adam"]);
  });

  it("does not reorder the array it was given", () => {
    const rows = [p("a", 1), p("b", 2)];
    const order = byResult(rows);
    expect(order).not.toBe(rows);
    expect(rows.map((row) => row.userId)).toEqual(["a", "b"]);
  });

  it("says two of the same person are the same", () => {
    expect(compareResults(p("a", 1), p("a", 1))).toBe(0);
  });

  it("sorts a whole league of people who did nothing, deterministically", () => {
    const nobody = ["f", "b", "d", "a", "e", "c"].map((id) => p(id, 0));
    expect(byResult(nobody).map((row) => row.userId)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("has an opinion about a negative week too", () => {
    const order = byResult([p("a", -4), p("b", -1), p("c", -9)]);
    expect(order.map((row) => row.userId)).toEqual(["b", "a", "c"]);
  });
});
