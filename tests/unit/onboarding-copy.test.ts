import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Nothing a reader sees may contain an em dash.

  Not a style preference. An em dash in product copy is one of the tells that
  a sentence was generated rather than written, and the whole walkthrough is
  an attempt to sound like a person explaining their own app. Model output is
  already covered: Arena has no model-written copy at all, so every
  sentence in it is hand-written and none of it had a guard.

  Scoped to the onboarding surfaces because those are the ones swept so far.
  Other screens still carry them. This list may grow and must never shrink.
*/
const SWEPT = [
  "src/lib/tour-steps.ts",
  "src/components/WelcomeTour.tsx",
  "src/app/onboarding/page.tsx",
];

const EM = "—";
const EN = "–";

/**
 * Lines that a reader could see: not `//`, not `/* *\/`, not `{/* *\/}`.
 *
 * Comments are for whoever maintains this and may punctuate however they
 * like. The rule is about the product, not the source.
 */
function readerFacingLines(file: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inBlock = false;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((raw, i) => {
      const t = raw.trim();
      if (inBlock) {
        if (t.includes("*/")) inBlock = false;
        return;
      }
      if (t.startsWith("/*") || t.startsWith("{/*")) {
        if (!t.includes("*/")) inBlock = true;
        return;
      }
      if (t.startsWith("//") || t.startsWith("*")) return;
      out.push({ line: i + 1, text: raw });
    });
  return out;
}

describe("onboarding copy reads as a person wrote it", () => {
  for (const file of SWEPT) {
    it(`${file} has no em dash a reader could see`, () => {
      const bad = readerFacingLines(file).filter((l) => l.text.includes(EM));
      expect(bad.map((b) => `${b.line}: ${b.text.trim()}`)).toEqual([]);
    });

    it(`${file} has no en dash a reader could see`, () => {
      const bad = readerFacingLines(file).filter((l) => l.text.includes(EN));
      expect(bad.map((b) => `${b.line}: ${b.text.trim()}`)).toEqual([]);
    });
  }

  /*
    The detector has to actually detect. A test that passes because it is
    looking at nothing is the failure mode this whole file exists to avoid.
  */
  it("reads real lines, and ignores comments", () => {
    const lines = readerFacingLines("src/lib/tour-steps.ts");
    expect(lines.length).toBeGreaterThan(50);
    expect(lines.some((l) => l.text.includes("export const STEPS"))).toBe(true);
    expect(lines.some((l) => l.text.includes("is a figure typed out by hand"))).toBe(false);
  });
});
