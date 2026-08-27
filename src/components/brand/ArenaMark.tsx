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

  Unique paint-server ids are a prop, so a server page (the landing hero)
  can draw this in the HTML without a hydration island, and a client header
  can still import it. Two copies on one page that share an id is the
  missing-logo bug: `url(#near)` resolves to the first match, which may be
  inside a hidden subtree and then paints nothing. Callers that mount more
  than one pass `uid`.
*/

import type { CSSProperties } from "react";

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
  /*
    Distinguishes paint servers when more than one mark is on the page.
    Header and walkthrough are both the default size, on the same Home
    screen, so they cannot share a default.
  */
  uid?: string;
  /*
    For the one adjustment a caller is allowed to make: where the drawing sits
    relative to whatever it stands beside. The lockup lifts it off the row's
    centre line (see LOCKUP_LIFT); nothing else should be reaching in here.
  */
  style?: CSSProperties;
};

function paintId(uid: string, name: string) {
  return `arena-${uid.replace(/[^a-zA-Z0-9]/g, "")}-${name}`;
}

export function ArenaMark({
  className,
  size = 20,
  title,
  uid,
  style,
}: ArenaMarkProps) {
  const token = uid ?? `s${String(size).replace(".", "p")}`;
  const ref = (name: string) => paintId(token, name);
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
      style={style}
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
