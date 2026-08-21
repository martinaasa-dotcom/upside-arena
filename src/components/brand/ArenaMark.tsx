/*
  Arena's own mark. Related to Lab's by construction, not identical.

  Shared family DNA: precision-cut triangular facets, warm-gold hue family,
  metallic light-to-dark facet shading.
  Different silhouette: Lab is a solid standing "A". Arena is an open chevron,
  notched at the apex into two opposing facet clusters, so it reads as upward
  motion and a head-to-head matchup rather than a letterform standing still.
*/

type ArenaMarkProps = {
  className?: string;
  size?: number;
  title?: string;
};

// Each facet is drawn full-size then scaled toward its own centroid, which
// produces the even hairline gaps the cut-gem treatment depends on.
const FACETS: { points: string; centroid: [number, number]; fill: string }[] = [
  // Left cluster, dark tail up to bright apex.
  { points: "2,38 16,21 2,58", centroid: [6.67, 39.0], fill: "url(#arena-deep)" },
  { points: "16,21 16,41 2,58", centroid: [11.33, 40.0], fill: "url(#arena-mid)" },
  { points: "16,21 30,4 16,41", centroid: [20.67, 22.0], fill: "url(#arena-warm)" },
  { points: "30,4 30,24 16,41", centroid: [25.33, 23.0], fill: "url(#arena-bright)" },
  // Right cluster, mirrored and shaded in the opposite order.
  { points: "62,38 48,21 62,58", centroid: [57.33, 39.0], fill: "url(#arena-mid)" },
  { points: "48,21 48,41 62,58", centroid: [52.67, 40.0], fill: "url(#arena-deep)" },
  { points: "48,21 34,4 48,41", centroid: [43.33, 22.0], fill: "url(#arena-bright)" },
  { points: "34,4 34,24 48,41", centroid: [38.67, 23.0], fill: "url(#arena-warm)" },
];

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
        <linearGradient id="arena-bright" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#f7e8bb" />
          <stop offset="100%" stopColor="#d9c184" />
        </linearGradient>
        <linearGradient id="arena-warm" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#e4cf94" />
          <stop offset="100%" stopColor="#c2a45f" />
        </linearGradient>
        <linearGradient id="arena-mid" x1="0.2" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c9a659" />
          <stop offset="100%" stopColor="#a8813a" />
        </linearGradient>
        <linearGradient id="arena-deep" x1="0.2" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a87c33" />
          <stop offset="100%" stopColor="#7d551d" />
        </linearGradient>
      </defs>
      {FACETS.map((facet, i) => {
        const [cx, cy] = facet.centroid;
        return (
          <polygon
            key={i}
            points={facet.points}
            fill={facet.fill}
            transform={`translate(${cx} ${cy}) scale(0.93) translate(${-cx} ${-cy})`}
          />
        );
      })}
    </svg>
  );
}
