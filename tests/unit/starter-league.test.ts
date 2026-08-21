import { describe, expect, it } from "vitest";
import { starterLeagueName } from "@/lib/game/starter-league";

/*
  The name a new player's first league gets. It goes straight into a column
  that holds forty characters and onto the home screen, so both the shape and
  the length matter.
*/
describe("starterLeagueName", () => {
  it("makes the name possessive", () => {
    expect(starterLeagueName("Martin")).toBe("Martin's league");
  });

  it("gives a name ending in s the bare apostrophe", () => {
    expect(starterLeagueName("Chris")).toBe("Chris' league");
    expect(starterLeagueName("Lucas")).toBe("Lucas' league");
  });

  it("does not care about the case of that trailing s", () => {
    expect(starterLeagueName("CHRIS")).toBe("CHRIS' league");
  });

  it("tidies whitespace rather than carrying it into the name", () => {
    expect(starterLeagueName("  Ada   Lovelace ")).toBe("Ada Lovelace's league");
  });

  it("falls back rather than naming a league after nobody", () => {
    expect(starterLeagueName("")).toBe("My league");
    expect(starterLeagueName("   ")).toBe("My league");
  });

  it("falls back rather than truncating a long name into something odd", () => {
    const long = "Bartholomew Fitzgerald Wellington the Third";
    expect(starterLeagueName(long)).toBe("My league");
  });

  it("never returns more than the column holds", () => {
    const names = ["Martin", "Chris", "", "A".repeat(80), "Ada Lovelace"];
    for (const name of names) {
      expect(starterLeagueName(name).length).toBeLessThanOrEqual(40);
    }
  });
});
