/*
  Arena's own mark. Related to Lab's by construction, not identical.

  Shared family DNA: precision-cut triangular facets, warm-gold hue family,
  metallic light-to-dark facet shading.
  Different silhouette: Lab is a solid standing "A". Arena is an open chevron,
  notched at the apex into two opposing facet clusters, so it reads as upward
  motion and a head-to-head matchup rather than a letterform standing still.
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
          fill={facet.fill}
          transform={facetTransform(facet)}
        />
      ))}
    </svg>
  );
}
