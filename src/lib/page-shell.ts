/*
  Shared layout constants. Same values Lab ships: 1200px page max, px-6 gutter,
  p-6 panel pad, gap-6 stack, gap-4 between score cards.
*/

export const PAGE_FRAME = "page-frame";

export const PAGE = "mx-auto w-full max-w-[1200px] px-6";

export const STACK = "flex flex-col gap-6";

/** Top-level panel. Translucent, never an opaque card. */
export const BOX =
  "card-sheen glass rounded-xl p-6 ring-1 ring-foreground/20";

/** Nested well inside a panel. No second card-in-card. */
export const CARD = "glass-well rounded-lg p-4";

/** A single number tile in a scoreboard row. */
export const SCORE_CELL = "card-sheen glass rounded-xl p-6 ring-1 ring-foreground/20";

export const LIST = "divide-y divide-border";

/** Fixed table row height. A row never wraps to two lines. */
export const ROW = "flex h-10 items-center gap-3";

export const HEADER_H = "h-14";
