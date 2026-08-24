import { describe, expect, it } from "vitest";
import { planForUnpriced } from "@/lib/game/settle";
import { hoursSinceContestEnd } from "@/lib/market/session";

/*
  What settling does about a company nobody can price.

  There are two ways to get this wrong and they fail in opposite directions.
  Give up too early and a passing outage upstream settles somebody's position
  at what they paid while the market has it at twice that. Never give up and
  one acquired company stops every player in that week being scored, forever,
  because scoring is all or nothing and the pass simply runs again.
*/
describe("what to do about the companies a week could not price", () => {
  const ordinary = { missing: [], priced: 12, hoursSinceEnd: 0.5 };

  it("scores straight away when everything priced", () => {
    expect(planForUnpriced(ordinary)).toEqual({ wait: false, atCost: [] });
  });

  it("waits while the week has only just ended", () => {
    const plan = planForUnpriced({ missing: ["DEAD"], priced: 11, hoursSinceEnd: 0.5 });
    expect(plan.wait).toBe(true);
    if (plan.wait) expect(plan.reason).toContain("DEAD");
  });

  it("settles around a company that is still unpriceable hours later", () => {
    expect(
      planForUnpriced({ missing: ["DEAD"], priced: 11, hoursSinceEnd: 8 })
    ).toEqual({ wait: false, atCost: ["DEAD"] });
  });

  it("waits however long it has been when half the week is missing", () => {
    // One company at a time is a delisting. Six of twelve is the provider,
    // and settling a week at cost through an outage is the invented figure
    // this whole path exists to refuse.
    const plan = planForUnpriced({ missing: Array(6).fill("X"), priced: 6, hoursSinceEnd: 72 });
    expect(plan.wait).toBe(true);
    if (plan.wait) expect(plan.reason).toContain("provider");
  });

  it("treats a week where nothing at all priced as the outage it is", () => {
    expect(planForUnpriced({ missing: ["A", "B"], priced: 0, hoursSinceEnd: 500 }).wait).toBe(
      true
    );
  });

  it("still settles a week where one name of many is dead", () => {
    const plan = planForUnpriced({
      missing: ["DEAD"],
      priced: 40,
      hoursSinceEnd: 6,
    });
    expect(plan).toEqual({ wait: false, atCost: ["DEAD"] });
  });
});

describe("how long ago a contest ended", () => {
  // 16:00 in New York on 12 June 2026 is 20:00 UTC, since the city is on
  // daylight time in June.
  const close = new Date("2026-06-12T20:00:00Z");

  it("is zero at the bell", () => {
    expect(hoursSinceContestEnd("2026-06-12", false, close)).toBeCloseTo(0, 5);
  });

  it("is negative before it", () => {
    expect(
      hoursSinceContestEnd("2026-06-12", false, new Date("2026-06-12T18:00:00Z"))
    ).toBeCloseTo(-2, 5);
  });

  it("counts through the night and into the next day", () => {
    expect(
      hoursSinceContestEnd("2026-06-12", false, new Date("2026-06-13T14:00:00Z"))
    ).toBeCloseTo(18, 5);
  });

  it("ends a market that never shuts at midnight, not at the bell", () => {
    // The same moment is eight hours short of the day being over.
    expect(hoursSinceContestEnd("2026-06-12", true, close)).toBeCloseTo(-8, 5);
  });
});
