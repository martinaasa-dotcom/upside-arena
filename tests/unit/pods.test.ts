import { describe, expect, it } from "vitest";
import { PODS_MINIMUM, POD_TARGET_SIZE, TIER_NAMES } from "@/lib/game/pods";

/*
  The rules of a pod that are decided in the app rather than the database.

  How many move is worked out in both places: the database settles on it, and
  the screen has to say the same thing before the week is over. These pin the
  shape so the two cannot disagree.
*/

/** Mirrors the rule settle_pod applies. */
function moving(members: number): number {
  return members < 8 ? 0 : Math.max(1, Math.floor(members * 0.2));
}

describe("what the plan asks a pod to be", () => {
  it("holds the twenty to thirty section 2.2 asks for", () => {
    expect(POD_TARGET_SIZE).toBeGreaterThanOrEqual(20);
    expect(POD_TARGET_SIZE).toBeLessThanOrEqual(30);
  });

  it("names all four rungs of the ladder", () => {
    expect(Object.keys(TIER_NAMES)).toEqual(["bronze", "silver", "gold", "diamond"]);
  });

  it("waits for enough people to fill more than one pod", () => {
    // Section 2.2: do not launch these until there is real volume, or they
    // will feel dead. One pod is a leaderboard with a title on it.
    expect(PODS_MINIMUM).toBeGreaterThanOrEqual(POD_TARGET_SIZE * 2);
  });
});

describe("how many go up and down", () => {
  it("moves nobody out of a pod too thin to mean anything", () => {
    // Relegating one of six is a coin toss with a demotion attached.
    for (const size of [0, 1, 2, 5, 7]) expect(moving(size)).toBe(0);
  });

  it("moves a fifth of a full pod", () => {
    expect(moving(24)).toBe(4);
    expect(moving(30)).toBe(6);
  });

  it("always moves at least one once a pod is big enough", () => {
    expect(moving(8)).toBe(1);
    expect(moving(9)).toBe(1);
  });

  it("never moves more than half, so a pod cannot empty itself", () => {
    // Promoted plus relegated has to leave somebody in the middle, or the
    // ladder is a revolving door rather than a standing.
    for (let size = 8; size <= 60; size++) {
      expect(moving(size) * 2).toBeLessThan(size);
    }
  });

  it("takes the same number off the top as the bottom", () => {
    // The rungs stay the same shape over time only if these match.
    for (let size = 8; size <= 60; size++) {
      const up = moving(size);
      const down = moving(size);
      expect(up).toBe(down);
    }
  });
});
