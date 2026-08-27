import { describe, expect, it } from "vitest";
import { TEMPLATES, templateIsPlayable, matchingTemplate } from "@/lib/game/templates";
import { isFormatId } from "@/lib/game/formats";
import { isLengthId } from "@/lib/game/lengths";
import { cadencesFor, isCadenceId } from "@/lib/game/cadence";

/*
  Named games, held to the catalogues they are built from.

  A recipe that names a format this build has dropped would start a contest
  the screen cannot explain. The form fills three knobs from these rows, so
  the rows have to be ones the knobs still offer.
*/

describe("the recipes", () => {
  it("names a format, a length and a cadence that still exist", () => {
    for (const template of TEMPLATES) {
      expect(isFormatId(template.format), template.id).toBe(true);
      expect(isLengthId(template.length), template.id).toBe(true);
      expect(isCadenceId(template.cadence), template.id).toBe(true);
      expect(templateIsPlayable(template), template.id).toBe(true);
      expect(cadencesFor(template.length), template.id).toContain(template.cadence);
    }
  });

  it("uses each id once", () => {
    const ids = TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a name and a rule for every recipe, in the words the card will say", () => {
    for (const template of TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.rule.length).toBeGreaterThan(0);
      expect(template.tagline.length).toBeGreaterThan(0);
    }
  });

  it("finds the recipe that is exactly these three knobs", () => {
    expect(matchingTemplate("silicon", "year", "monthly")).toBe("year_of_chips");
    expect(matchingTemplate("open", "week", "always")).toBeNull();
  });
});
