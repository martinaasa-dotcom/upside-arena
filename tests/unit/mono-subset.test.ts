import { describe, expect, it } from "vitest";
import {
  MONO_SUBSET_RANGES,
  monoSubsetCovers,
  monoSubsetUnicodes,
} from "@/lib/brand/mono-subset";
import { shareText } from "@/lib/share/card";
import { formatGap, formatMoney, formatPercent } from "@/lib/format";

/*
  The mono face is subset, so a character this app can print in it and the
  subset does not carry is set in the system monospace instead.

  That is a failure nothing else catches. It breaks no build, fails no type,
  and throws nothing at runtime -- the week somebody pastes into a group chat
  just comes out in the wrong face, and only they ever see it. So the list
  that decides the subset is checked here against the things the app actually
  prints in mono.
*/

function uncovered(text: string): string[] {
  return [...new Set([...text])].filter((c) => !monoSubsetCovers(c));
}

const RECAP = {
  displayName: "Sam",
  title: null,
  monday: "2026-08-17",
  returnPercent: 3.8,
  benchmarkReturn: 1.2,
  benchmarkDiff: 2.6,
  league: { name: "Sunday Roasters", rank: 2, size: 4 },
  streakDays: 5,
  marks: [100_000, 101_200, 100_400, 102_900, 103_800],
};

describe("what the mono subset has to carry", () => {
  it("carries the blocks the pasteable week is drawn with", () => {
    /*
      The one that would go unnoticed. These are U+2581 to U+2588 and they are
      the whole point of the pasteable text: Wordle travelled on its grid.
    */
    const text = shareText(RECAP, "https://upsidearena.com/w/abc");
    expect(uncovered(text)).toEqual([]);
  });

  it("carries every block element individually", () => {
    for (const block of "▁▂▃▄▅▆▇█") {
      expect(monoSubsetCovers(block)).toBe(true);
    }
  });

  it("carries the figures every screen is mostly made of", () => {
    const printed = [
      formatMoney(103_800),
      formatMoney(-1_234.56),
      formatPercent(3.8),
      formatPercent(-0.65),
      formatGap(2.6),
      "0123456789",
    ].join(" ");

    expect(uncovered(printed)).toEqual([]);
  });

  it("carries an invite code, which is letters and digits", () => {
    expect(uncovered("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")).toEqual([]);
  });

  it("carries the punctuation the app sets in figures", () => {
    // An en dash and a real minus sign are not a hyphen, and all three appear.
    expect(uncovered("-–—.,:%+/()$£€'’\"“”")).toEqual([]);
  });

  it("does not carry what it was subset to drop", () => {
    // Cyrillic, Greek and the box-drawing characters that are not blocks.
    expect(monoSubsetCovers("А")).toBe(false);
    expect(monoSubsetCovers("Ω")).toBe(false);
    expect(monoSubsetCovers("─")).toBe(false);
  });
});

describe("the range list the font is built from", () => {
  it("gives pyftsubset the form it parses", () => {
    /*
      Only the lower bound carries the U+ prefix. "U+2581-U+2588" is rejected
      with a parse error on an empty upper bound, which is how this was found.
    */
    const unicodes = monoSubsetUnicodes();

    expect(unicodes).toContain("U+2581-2588");
    expect(unicodes).not.toMatch(/-U\+/);
    expect(unicodes.split(",")).toHaveLength(MONO_SUBSET_RANGES.length);
  });

  it("says why every range is there", () => {
    for (const range of MONO_SUBSET_RANGES) {
      expect(range.why.length).toBeGreaterThan(0);
      expect(range.from).toBeLessThanOrEqual(range.to);
    }
  });
});
