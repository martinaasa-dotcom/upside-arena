import { describe, expect, it } from "vitest";
import {
  PODS_MINIMUM,
  POD_TARGET_SIZE,
  TIER_NAMES,
  movingFrom,
  podZone,
  RESULT_VISIBLE_DAYS,
} from "@/lib/game/pods";

/*
  The rules of a pod that are decided in the app rather than the database.

  How many move is worked out in both places: the database settles on it, and
  the screen has to say the same thing before the week is over. These pin the
  shape so the two cannot disagree.
*/

/** The same rule settle_pod applies, and the one the screen shows. */
const moving = movingFrom;

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

describe("which way a place is heading", () => {
  it("sends the top places up and the bottom places down", () => {
    const size = 24;
    const going = movingFrom(size); // 4

    expect(podZone(1, size, going)).toBe("promoted");
    expect(podZone(going, size, going)).toBe("promoted");
    expect(podZone(going + 1, size, going)).toBe("held");
    expect(podZone(size - going, size, going)).toBe("held");
    expect(podZone(size - going + 1, size, going)).toBe("relegated");
    expect(podZone(size, size, going)).toBe("relegated");
  });

  it("holds everybody when the pod is too thin to move anyone", () => {
    for (let rank = 1; rank <= 7; rank++) {
      expect(podZone(rank, 7, movingFrom(7))).toBe("held");
    }
  });

  it("never puts one place in two zones, at any pod size", () => {
    // The row shows one arrow. If the promotion and relegation bands could
    // overlap, the arrow would be deciding something the ladder had not.
    for (let size = 1; size <= 60; size++) {
      const going = movingFrom(size);
      const zones = Array.from({ length: size }, (_, i) => podZone(i + 1, size, going));
      expect(zones.filter((z) => z === "promoted")).toHaveLength(going);
      expect(zones.filter((z) => z === "relegated")).toHaveLength(going);
      expect(zones.filter((z) => z === "held")).toHaveLength(size - going * 2);
    }
  });
});

describe("how long a finished pod stays up", () => {
  it("covers the gap between a week being scored and somebody reading about it", () => {
    // Scored Friday evening, the message goes out Saturday morning and again
    // Saturday afternoon for anyone who was asleep. Somebody who opens it on
    // Sunday still has to find the thing it is about.
    expect(RESULT_VISIBLE_DAYS).toBeGreaterThanOrEqual(3);
  });

  it("does not outlive the sentence describing it", () => {
    // The panel says "how last week finished". A pod from a fortnight ago
    // under that heading is a screen stating something false, so the window
    // cannot be longer than a week.
    expect(RESULT_VISIBLE_DAYS).toBeLessThanOrEqual(7);
  });
});
