import { describe, expect, it } from "vitest";
import { GOALS, GOAL_KINDS, goalLabel, goalMet, isGoalKind } from "@/lib/game/goal-kinds";
import type { Standing } from "@/lib/game/leagues";

/*
  The declared weekly goal. Section 3 permits public commitment and forbids
  fabricated near-misses, and both of those live in goalMet: a week that has
  not decided yet has to say so rather than report a failure.
*/

function standing(overrides: Partial<Standing> = {}): Standing {
  return {
    userId: "u1",
    displayName: "Ann",
    handle: null,
    avatarUrl: null,
    rank: 1,
    totalValue: 100_000,
    returnPercent: 0,
    versusMarket: null,
    todayPercent: null,
    isYou: true,
    hasTraded: true,
    ...overrides,
  };
}

const WEEK = { streakThisWeek: 0, tradingDaysSoFar: 1 };

describe("the goals on offer", () => {
  it("offers a fixed set, never free text", () => {
    // Free text inside somebody else's league is a moderation surface, and
    // this product has no moderation tooling.
    expect(GOALS.length).toBeGreaterThan(0);
    expect(GOAL_KINDS).toEqual(GOALS.map((goal) => goal.kind));
  });

  it("recognises only its own", () => {
    for (const kind of GOAL_KINDS) expect(isGoalKind(kind)).toBe(true);
    expect(isGoalKind("get_rich_quick")).toBe(false);
    expect(isGoalKind("")).toBe(false);
  });

  it("has something to call every one of them", () => {
    for (const kind of GOAL_KINDS) {
      expect(goalLabel(kind).length).toBeGreaterThan(0);
    }
  });

  it("includes one that has nothing to do with money", () => {
    expect(GOAL_KINDS).toContain("every_day");
  });
});

describe("whether a goal has been met", () => {
  it("says nothing about beating the market until the market is known", () => {
    expect(goalMet("beat_market", standing({ versusMarket: null }), WEEK)).toBe(null);
    expect(goalMet("beat_market", standing({ versusMarket: 0.4 }), WEEK)).toBe(true);
    expect(goalMet("beat_market", standing({ versusMarket: -0.4 }), WEEK)).toBe(false);
    // Level with the market is not ahead of it.
    expect(goalMet("beat_market", standing({ versusMarket: 0 }), WEEK)).toBe(false);
  });

  it("reads finishing up off the return", () => {
    expect(goalMet("finish_up", standing({ returnPercent: 1.2 }), WEEK)).toBe(true);
    expect(goalMet("finish_up", standing({ returnPercent: 0 }), WEEK)).toBe(false);
  });

  it("reads the top three off the rank", () => {
    expect(goalMet("top_three", standing({ rank: 3 }), WEEK)).toBe(true);
    expect(goalMet("top_three", standing({ rank: 4 }), WEEK)).toBe(false);
  });

  it("leaves showing up every day open while it is still possible", () => {
    // Tuesday, turned up both days. Nothing has gone wrong, and saying it
    // had would be a near-miss we made up.
    expect(
      goalMet("every_day", standing(), { streakThisWeek: 2, tradingDaysSoFar: 2 })
    ).toBe(null);
  });

  it("settles it early once a day has actually been missed", () => {
    expect(
      goalMet("every_day", standing(), { streakThisWeek: 1, tradingDaysSoFar: 2 })
    ).toBe(false);
  });

  it("meets it on the fifth day", () => {
    expect(
      goalMet("every_day", standing(), { streakThisWeek: 5, tradingDaysSoFar: 5 })
    ).toBe(true);
  });
});
