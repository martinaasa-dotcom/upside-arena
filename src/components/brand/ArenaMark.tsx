/*
  Arena's own mark. Related to Lab's by construction, not by colour.

  Shared family DNA: precision-cut facets, flat fills with no strokes, and
  metallic light-to-dark facet shading on the same 64 grid.
  Different silhouette and different stone: Lab is a solid standing "A" in
  warm gold. Arena is a single eight-sided stone parted along its diagonal,
  cut from aqua, so the two marks are unmistakably siblings and unmistakably
  not the same product.

  The parting is what carries the meaning. One stone, cleanly split, with the
  lit half in front and the shadowed half falling back behind it.

  The geometry itself lives in src/lib/brand/mark.ts, because the share card
  has to draw the same stone into a PNG and a second copy would drift. The
  reasoning is in docs/brand/ARENA_MARK.md.
*/

import { MARK_FACETS, MARK_GRADIENTS, facetTransform } from "@/lib/brand/mark";

type ArenaMarkProps = {
  className?: string;
  size?: number;
  title?: string;
};

export function ArenaMark({ className, size = 20, title }: ArenaMarkProps) {
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
            id={gradient.id}
            x1={gradient.x1}
            y1={gradient.y1}
            x2={gradient.x2}
            y2={gradient.y2}
          >
            <stop offset="0%" stopColor={gradient.from} />
            <stop offset="100%" stopColor={gradient.to} />
          </linearGradient>
        ))}
      </defs>
      {MARK_FACETS.map((facet, i) => (
        <polygon
          key={i}
          points={facet.points}
          fill={`url(#${facet.fill})`}
          transform={facetTransform(facet)}
        />
      ))}
    </svg>
  );
}
