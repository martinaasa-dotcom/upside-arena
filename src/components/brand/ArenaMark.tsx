"use client";

/*
  Arena's own mark. Related to Lab's by construction, not by colour.

  Shared family DNA: one flat drawing, no strokes, a ramp that runs across the
  whole drawing rather than per shape, and hairline cuts between the masses.
  What differs is the story. Lab draws one peak -- a standing gold "A" cut
  into ten facets -- because your own portfolio has nobody else in it. Arena
  draws two, a near one ahead and a far one behind, because Arena is a game
  against people you know.

  This draws the **app's** colourway: aqua, transparent, for the app's own
  true-black chrome. The app icon uses the other one -- see COLOURWAYS in
  src/lib/brand/mark.ts, and docs/brand/ARENA_MARK.md for why an icon is the
  reverse of a header.

  The geometry lives in src/lib/brand/mark.ts, because the share card and the
  icon rasters have to draw the same thing through different renderers and a
  second copy would drift.
*/

import { useId } from "react";

import {
  COLOURWAYS,
  FAR_PEAK,
  NEAR_PEAK,
  RAMP_AXES,
  cutForSize,
  peakPath,
} from "@/lib/brand/mark";

type ArenaMarkProps = {
  className?: string;
  size?: number;
  title?: string;
};

export function ArenaMark({ className, size = 20, title }: ArenaMarkProps) {
  /*
    Unique ids per instance, and this is load-bearing rather than tidiness.

    The lockup renders more than once per page: the header and a page's own
    hero both mount it. Fixed ids mean `url(#near)` resolves to the first
    match in document order, which may be a copy inside a subtree a breakpoint
    has hidden -- and a paint server in a `display:none` subtree does not
    paint, so the visible mark fills with nothing. It holds its box and draws
    absolutely nothing, which is exactly what "the logo is missing" looks
    like.

    `useId` is stable across server and client render, so this does not cause
    a hydration mismatch. The punctuation React puts in the value is legal in
    an id but awkward in a URL fragment, so it is stripped.
  */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = (name: string) => `arena-${uid}-${name}`;
  const way = COLOURWAYS.MARK;

  return (
    <svg
      /*
        Square, and the drawing sits inside it with a little air. The mark is
        62 by 56 on this grid, so a square box leaves four units top and
        bottom -- which is what keeps the lockup's metrics unchanged whatever
        the drawing does inside them.
      */
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        {(["near", "far"] as const).map((key) => (
          <linearGradient
            key={key}
            id={ref(key)}
            x1={RAMP_AXES[key].x1}
            y1={RAMP_AXES[key].y1}
            x2={RAMP_AXES[key].x2}
            y2={RAMP_AXES[key].y2}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={way[key].from} />
            <stop offset="1" stopColor={way[key].to} />
          </linearGradient>
        ))}
        {/*
          The hairline that parts the two peaks, cut out of the far one rather
          than painted between them: the mark is transparent, so there is no
          colour to paint the gap with. The cut widens as the drawing shrinks,
          because what has to survive is a pixel on screen rather than a
          number in the grid. In the header this renders at 20px, where a
          poster-sized hairline would be a fifth of a pixel and the two peaks
          would fuse into one blob.
        */}
        <mask
          id={ref("cut")}
          maskUnits="userSpaceOnUse"
          x="-8"
          y="-8"
          width="80"
          height="80"
        >
          <rect x="-8" y="-8" width="80" height="80" fill="#fff" />
          <path
            d={peakPath(NEAR_PEAK)}
            fill="#000"
            stroke="#000"
            strokeWidth={cutForSize(size)}
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <path
        d={peakPath(FAR_PEAK)}
        fill={`url(#${ref("far")})`}
        mask={`url(#${ref("cut")})`}
      />
      <path d={peakPath(NEAR_PEAK)} fill={`url(#${ref("near")})`} />
    </svg>
  );
}
