/*
  What the mono face is allowed to be asked to draw.

  Geist Mono ships 889 glyphs, including Cyrillic, Greek and 128 box-drawing
  and quadrant characters. Every visitor downloaded all of them, and woff2 is
  already compressed, so it was weight no amount of gzip on the wire could
  take back. The face this app actually needs is the one below.

  This list is the source of the subset rather than a description of it: the
  regeneration command is printed from it by `npm run fonts`, so the file on
  disk and the ranges here cannot drift apart.

  A character outside these ranges is not blank. The browser falls through to
  the next family in --font-mono and sets it in the system monospace, so the
  failure mode is a character in the wrong face rather than a missing one.
  That is still worth avoiding, which is what the test beside this checks.
*/

export type CodepointRange = { from: number; to: number; why: string };

export const MONO_SUBSET_RANGES: CodepointRange[] = [
  { from: 0x0000, to: 0x00ff, why: "Latin, Latin-1: letters, digits, £ ¥ ¢ § °" },
  { from: 0x0100, to: 0x017f, why: "Latin Extended-A, for accented names in a code or a label" },
  { from: 0x0304, to: 0x0304, why: "combining macron" },
  { from: 0x0308, to: 0x0308, why: "combining diaeresis" },
  { from: 0x0329, to: 0x0329, why: "combining vertical line below" },
  { from: 0x2000, to: 0x206f, why: "General Punctuation: – — ' ' “ ” … ‰" },
  { from: 0x2070, to: 0x2070, why: "superscript zero" },
  { from: 0x2074, to: 0x2079, why: "superscript digits" },
  { from: 0x2080, to: 0x2089, why: "subscript digits" },
  { from: 0x20a0, to: 0x20bf, why: "Currency Symbols, € among them" },
  { from: 0x2122, to: 0x2122, why: "trade mark" },
  { from: 0x2190, to: 0x2193, why: "arrows, for a rank that moved" },
  { from: 0x2212, to: 0x2212, why: "minus sign, which is not a hyphen" },
  { from: 0x2215, to: 0x2215, why: "division slash" },
  {
    from: 0x2581,
    to: 0x2588,
    why: "block elements: the shape of a week in the pasteable share text",
  },
  { from: 0xfeff, to: 0xfeff, why: "byte order mark" },
  { from: 0xfffd, to: 0xfffd, why: "replacement character" },
];

/** Whether the subset can set this character in the mono face. */
export function monoSubsetCovers(character: string): boolean {
  const code = character.codePointAt(0);
  if (code == null) return false;
  return MONO_SUBSET_RANGES.some((range) => code >= range.from && code <= range.to);
}

/**
 * The ranges as pyftsubset wants them. Used by `npm run fonts`.
 *
 * Only the lower bound carries the U+ prefix: the library reads "U+2581-2588"
 * and rejects "U+2581-U+2588" with a parse error on the empty upper bound.
 */
export function monoSubsetUnicodes(): string {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
  return MONO_SUBSET_RANGES.map((r) =>
    r.from === r.to ? `U+${hex(r.from)}` : `U+${hex(r.from)}-${hex(r.to)}`
  ).join(",");
}
