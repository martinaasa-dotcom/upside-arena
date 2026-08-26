import { describe, expect, it } from "vitest";
import {
  DRAFTABLE_FORMATS,
  MAX_SEATS,
  MIN_SEATS,
  autoPick,
  boardFor,
  budgetPerPick,
  draftFits,
  draftProgress,
  isDraftable,
  maxRounds,
  pickClockLabel,
  pickOrder,
  roundForPick,
  seatForPick,
  sharesForPick,
  totalPicks,
  turnsUntil,
} from "@/lib/game/draft-order";
import { FORMATS, formatById } from "@/lib/game/formats";

/*
  The arithmetic a draft is decided by.

  Everything here is pure, which is the whole reason it is a separate file from
  draft.ts: the running order is written into the database before the first
  pick, so if the snake is wrong it is wrong for the whole evening and there is
  no way to put it right halfway through.

  The one thing this file cannot check is that the database agrees, because the
  database deliberately does not re-implement any of it. What start_draft
  enforces instead is the fairness property (everybody picks the same number of
  times), and supabase/tests/drafts.test.sql is where that is held to.
*/

describe("the snake", () => {
  it("runs down the seats and then back up", () => {
    // Four seats: 0,1,2,3 then 3,2,1,0 then 0,1,2,3 again.
    expect(pickOrder(4, 3)).toEqual([0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3]);
  });

  it("gives the last seat in a round the first pick of the next", () => {
    const seats = 5;
    // The last pick of round one and the first of round two are the same seat.
    expect(seatForPick(seats - 1, seats)).toBe(seats - 1);
    expect(seatForPick(seats, seats)).toBe(seats - 1);
  });

  it("gives every seat exactly one pick per round", () => {
    for (let seats = MIN_SEATS; seats <= MAX_SEATS; seats += 1) {
      for (let rounds = 1; rounds <= 5; rounds += 1) {
        const counts = new Map<number, number>();
        for (const seat of pickOrder(seats, rounds)) {
          counts.set(seat, (counts.get(seat) ?? 0) + 1);
        }
        expect(counts.size).toBe(seats);
        for (const count of counts.values()) expect(count).toBe(rounds);
      }
    }
  });

  /*
    The property the snake exists for.

    Straight repetition would make seat one worth having and the last seat
    worth nothing, and since the seats are dealt at random that is a contest
    decided before anybody picks. Summing each seat's pick numbers is the
    plainest way to say "no seat is systematically earlier than another": under
    a snake with an even number of rounds every seat's total is identical.
  */
  it("balances the seats exactly over an even number of rounds", () => {
    for (let seats = MIN_SEATS; seats <= MAX_SEATS; seats += 1) {
      const totals = new Map<number, number>();
      pickOrder(seats, 4).forEach((seat, pick) => {
        totals.set(seat, (totals.get(seat) ?? 0) + pick);
      });
      expect(new Set(totals.values()).size).toBe(1);
    }
  });

  it("counts rounds from one", () => {
    expect(roundForPick(0, 3)).toBe(1);
    expect(roundForPick(2, 3)).toBe(1);
    expect(roundForPick(3, 3)).toBe(2);
  });

  it("has an answer for a seat count it should never see", () => {
    expect(seatForPick(0, 0)).toBe(0);
    expect(pickOrder(0, 3)).toEqual([]);
    expect(totalPicks(0, 3)).toBe(0);
  });
});

describe("waiting for your turn", () => {
  it("is zero when it is yours", () => {
    expect(turnsUntil(2, 2, 4, 3)).toBe(0);
  });

  it("counts the turns in between", () => {
    // Four seats, pick 0 is live, seat 3 goes fourth.
    expect(turnsUntil(3, 0, 4, 3)).toBe(3);
  });

  it("is null once you have no picks left", () => {
    // Two seats, one round: seat 0 picks first and is then finished.
    expect(turnsUntil(0, 1, 2, 1)).toBeNull();
  });

  /*
    The case the snake creates and a naive countdown gets wrong: at the turn of
    a round the same seat picks twice in a row, so the person who has just
    picked is up again immediately rather than in `seats` turns.
  */
  it("says next when the snake turns back on the same person", () => {
    expect(turnsUntil(3, 4, 4, 2)).toBe(0);
  });
});

describe("what a pick is worth", () => {
  it("divides the starting money by the rounds", () => {
    expect(budgetPerPick(100_000, 4)).toBe(25_000);
  });

  it("rounds down to the cent, so the picks together never exceed the money", () => {
    const budget = budgetPerPick(100_000, 3);
    expect(budget).toBe(33_333.33);
    expect(budget * 3).toBeLessThanOrEqual(100_000);
  });

  it("buys whole shares and leaves the rest as cash", () => {
    expect(sharesForPick(50_000, 180)).toBe(277);
    expect(sharesForPick(50_000, 180) * 180).toBeLessThanOrEqual(50_000);
  });

  it("buys nothing at a price it cannot use", () => {
    expect(sharesForPick(50_000, 0)).toBe(0);
    expect(sharesForPick(50_000, Number.NaN)).toBe(0);
    expect(sharesForPick(0, 180)).toBe(0);
  });

  it("buys nothing when one share costs more than a pick", () => {
    expect(sharesForPick(1_000, 1_200)).toBe(0);
  });
});

describe("fitting a draft on a board", () => {
  it("is how many whole rounds the board carries", () => {
    expect(maxRounds(24, 5)).toBe(4);
    expect(maxRounds(7, 3)).toBe(2);
  });

  it("refuses a draft that would run the board out mid-pick", () => {
    expect(draftFits(24, 5, 4)).toBe(true);
    expect(draftFits(24, 5, 5)).toBe(false);
  });

  it("refuses a room that is too small or too big to be a draft", () => {
    expect(draftFits(24, 1, 2)).toBe(false);
    expect(draftFits(500, MAX_SEATS + 1, 2)).toBe(false);
  });

  it("has an answer below the minimum rather than dividing by nothing", () => {
    expect(maxRounds(24, 0)).toBe(0);
    expect(maxRounds(24, 1)).toBe(0);
  });
});

describe("the board", () => {
  /*
    Derived rather than listed, so a format added with a hand-picked list is
    draftable the day it lands and one added as a kind of thing is not, without
    anybody having to remember draft-order.ts exists.
  */
  it("is every format whose universe is a list of names", () => {
    for (const format of FORMATS) {
      expect(isDraftable(format)).toBe(format.universe.kind === "list");
    }
    expect(DRAFTABLE_FORMATS.length).toBeGreaterThan(0);
  });

  it("is null for a format that is a kind of thing rather than a list", () => {
    expect(boardFor(formatById("open"))).toBeNull();
    expect(boardFor(formatById("index"))).toBeNull();
  });

  /*
    Every draftable board has to carry the smallest real draft, or the form
    would offer a game that cannot be played. Two people picking twice is four
    names, which is the floor.
  */
  it("carries the smallest draft anybody could hold", () => {
    for (const format of DRAFTABLE_FORMATS) {
      const board = boardFor(format);
      expect(board).not.toBeNull();
      expect(draftFits(board!.length, MIN_SEATS, 2)).toBe(true);
    }
  });

  it("has no name on it twice, because taking one takes it from everybody", () => {
    for (const format of DRAFTABLE_FORMATS) {
      const board = boardFor(format)!;
      expect(new Set(board).size).toBe(board.length);
    }
  });
});

describe("the clock's pick", () => {
  it("takes the first name still standing, in the board's own order", () => {
    expect(autoPick(["NVDA", "AMD", "INTC"], ["NVDA"])).toBe("AMD");
  });

  it("takes the top of the board when nothing has gone", () => {
    expect(autoPick(["NVDA", "AMD"], [])).toBe("NVDA");
  });

  it("has nothing to take once the board is bare", () => {
    expect(autoPick(["NVDA"], ["NVDA"])).toBeNull();
    expect(autoPick([], [])).toBeNull();
  });
});

describe("what the room says", () => {
  it("counts the round and the pick from one", () => {
    expect(draftProgress(0, 3, 2)).toBe("Round 1 of 2, pick 1 of 6");
    expect(draftProgress(3, 3, 2)).toBe("Round 2 of 2, pick 4 of 6");
  });

  it("says so once there is nothing left to pick", () => {
    expect(draftProgress(6, 3, 2)).toBe("All picked");
  });

  it("says the clock in the unit a person would use", () => {
    expect(pickClockLabel(30)).toBe("30 seconds a pick");
    expect(pickClockLabel(60)).toBe("A minute a pick");
    expect(pickClockLabel(120)).toBe("2 minutes a pick");
  });
});
