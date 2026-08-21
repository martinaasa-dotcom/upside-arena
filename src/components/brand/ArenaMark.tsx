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
*/

type ArenaMarkProps = {
  className?: string;
  size?: number;
  title?: string;
};

/*
  Geometry comes from an octagon of radius 26 about (32, 32), rotated 22.5deg
  so the stone sits flat, then parted along the diagonal by 1.5 in each
  direction. Each facet is drawn full-size and scaled toward its own centroid,
  which produces the even hairline gaps the cut-stone treatment depends on.
  Kept in step with scripts/generate-icons.mjs.
*/
const FACETS: { points: string; centroid: [number, number]; fill: string }[] = [
  // Upper half: the rim catches the light, the lit face carries the stone.
  { points: "23.55,6.48 43.45,6.48 57.52,20.55", centroid: [41.51, 11.17], fill: "arena-rim" },
  { points: "23.55,6.48 57.52,20.55 57.52,40.45 43.45,54.52", centroid: [45.51, 30.5], fill: "arena-lit" },
  // Lower half: falls away behind the cut.
  { points: "40.45,57.52 20.55,57.52 6.48,43.45", centroid: [22.49, 52.83], fill: "arena-body" },
  { points: "40.45,57.52 6.48,43.45 6.48,23.55 20.55,9.48", centroid: [18.49, 33.5], fill: "arena-shadow" },
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
        <linearGradient id="arena-rim" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#d9f7ff" />
          <stop offset="100%" stopColor="#a6e4f2" />
        </linearGradient>
        <linearGradient id="arena-lit" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#4fd0e0" />
          <stop offset="100%" stopColor="#2a9fb5" />
        </linearGradient>
        <linearGradient id="arena-body" x1="0.2" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#17879c" />
          <stop offset="100%" stopColor="#0d6070" />
        </linearGradient>
        <linearGradient id="arena-shadow" x1="0.2" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0b4a58" />
          <stop offset="100%" stopColor="#052e36" />
        </linearGradient>
      </defs>
      {FACETS.map((facet, i) => {
        const [cx, cy] = facet.centroid;
        return (
          <polygon
            key={i}
            points={facet.points}
            fill={`url(#${facet.fill})`}
            transform={`translate(${cx} ${cy}) scale(0.93) translate(${-cx} ${-cy})`}
          />
        );
      })}
    </svg>
  );
}
