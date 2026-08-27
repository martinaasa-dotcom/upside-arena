/*
  Shared layout constants. Same values Lab ships: 1200px page max, px-6 gutter,
  p-6 panel pad, gap-6 stack, gap-4 between score cards.
*/

export const PAGE_FRAME = "page-frame";

export const PAGE = "mx-auto w-full max-w-[1200px] px-6";

export const STACK = "flex flex-col gap-6";

/*
  Two columns on a wide screen, one on anything narrower.

  Every room was a single column of panels the width of the page, which is
  right on a phone and is what a desktop had been given too: at 1440px a
  standings row was eleven hundred pixels with a name at one end, a percentage
  at the other and a canyon between them, and a screen and a half of scrolling
  to reach a form that could have been beside it.

  The ratio is deliberate. The left column holds the thing somebody came for --
  the table, what they own, the week -- and stays the wider of the two so its
  rows read as rows rather than as a name and a number that have drifted apart.
  The right holds what they might do next.

  It breaks at lg rather than md. Between the two the columns are narrow enough
  that a figure and its label start wrapping, which is worse than scrolling.

  `items-start` matters: without it the two columns stretch to match, and the
  shorter one grows a panel-coloured void under its last panel.
*/
export const SPLIT =
  "grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]";

/** A column inside SPLIT. min-w-0 so a long name truncates rather than pushes. */
export const COLUMN = "flex min-w-0 flex-col gap-6";

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

/*
  Settings, menus and list actions (label left, control right) live in
  `src/components/ui/setting-row.tsx`. Those must not wrap; ROW is the
  shorter table variant and is a different job.
*/

export const HEADER_H = "h-14";
