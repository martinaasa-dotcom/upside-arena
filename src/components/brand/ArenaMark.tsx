"use client";

/*
  Arena's own mark. Related to Lab's by construction, not by colour.

  Shared family DNA: one flat drawing on the same 64 grid, no strokes, a light
  ramp that runs top-left to bottom-right, and hairline cuts between the
  masses. What differs is the story. Lab draws one peak -- a standing gold "A"
  cut into ten facets -- because your own portfolio has nobody else in it.
  Arena draws two in aqua, a near one ahead and a far one behind, because
  Arena is a game against people you know.

  The geometry lives in src/lib/brand/mark.ts, because the share card and the
  icon rasters have to draw the same thing through different renderers and a
  second copy would drift. The reasoning is in docs/brand/ARENA_MARK.md.
*/

import { useId } from "react";

import {
  FAR_PEAK,
  MARK_GRADIENTS,
  MARK_ZOOM,
  NEAR_PEAK,
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
    hero both mount it. Fixed ids mean `url(#arena-near)` resolves to the
    first match in document order, which may be a copy inside a subtree a
    breakpoint has hidden -- and a paint server in a `display:none` subtree
    does not paint, so the visible mark fills with nothing. It holds its box
    and draws absolutely nothing, which is exactly what "the logo is missing"
    looks like.

    `useId` is stable across server and client render, so this does not cause
    a hydration mismatch. The punctuation React puts in the value is legal in
    an id but awkward in a URL fragment, so it is stripped.
  */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = (name: string) => `arena-${uid}-${name}`;

  return (
    <svg
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
        {MARK_GRADIENTS.map((gradient) => (
          <linearGradient
            key={gradient.id}
            id={ref(gradient.id)}
            x1={gradient.x1}
            y1={gradient.y1}
            x2={gradient.x2}
            y2={gradient.y2}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={gradient.from} />
            <stop offset="1" stopColor={gradient.to} />
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
          x="0"
          y="0"
          width="64"
          height="64"
        >
          <rect width="64" height="64" fill="#fff" />
          <path
            d={peakPath(NEAR_PEAK)}
            fill="#000"
            stroke="#000"
            strokeWidth={cutForSize(size)}
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <g
        transform={`translate(32 32) scale(${MARK_ZOOM}) translate(-32 -32)`}
      >
        <path
          d={peakPath(FAR_PEAK)}
          fill={`url(#${ref(FAR_PEAK.fill)})`}
          mask={`url(#${ref("cut")})`}
        />
        <path d={peakPath(NEAR_PEAK)} fill={`url(#${ref(NEAR_PEAK.fill)})`} />
      </g>
    </svg>
  );
}
