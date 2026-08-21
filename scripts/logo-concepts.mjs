/*
  Ten alternative Arena mark silhouettes, drawn in Lab's cut-gem style.

  Every concept reuses the family DNA exactly as ArenaMark.tsx defines it:
  the same four warm-gold gradients, flat facets with no stroke, and each
  facet scaled toward its own centroid so the cuts read as hairline gaps.
  Only the silhouette changes. Run with `node scripts/logo-concepts.mjs`.
*/
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const GRADIENTS = `
  <linearGradient id="arena-bright" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0%" stop-color="#f7e8bb"/><stop offset="100%" stop-color="#d9c184"/>
  </linearGradient>
  <linearGradient id="arena-warm" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0%" stop-color="#e4cf94"/><stop offset="100%" stop-color="#c2a45f"/>
  </linearGradient>
  <linearGradient id="arena-mid" x1="0.2" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#c9a659"/><stop offset="100%" stop-color="#a8813a"/>
  </linearGradient>
  <linearGradient id="arena-deep" x1="0.2" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#a87c33"/><stop offset="100%" stop-color="#7d551d"/>
  </linearGradient>`;

const r1 = (n) => Math.round(n * 100) / 100;

// [x, y, x, y, ...] with a shade name. Centroid is averaged from the vertices,
// which is close enough to the true area centroid for an even cut.
function facet(coords, shade) {
  const pts = [];
  for (let i = 0; i < coords.length; i += 2) pts.push([coords[i], coords[i + 1]]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { points: pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(" "), c: [cx, cy], shade };
}

const rot = (coords, deg, ox = 32, oy = 32) => {
  const a = (deg * Math.PI) / 180;
  const out = [];
  for (let i = 0; i < coords.length; i += 2) {
    const dx = coords[i] - ox;
    const dy = coords[i + 1] - oy;
    out.push(ox + dx * Math.cos(a) - dy * Math.sin(a), oy + dx * Math.sin(a) + dy * Math.cos(a));
  }
  return out;
};

// A bar rendered as two triangles, so a rectangle still reads as cut stone.
const bar = (x0, x1, top, bottom, lit, dark) => [
  facet([x0, top, x1, top, x0, bottom], lit),
  facet([x1, top, x1, bottom, x0, bottom], dark),
];

const ring = (n, outer, inner, squash, shades, rotateDeg = 0) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a0 = ((i / n) * 360 + rotateDeg - 90) * (Math.PI / 180);
    const a1 = (((i + 1) / n) * 360 + rotateDeg - 90) * (Math.PI / 180);
    const p = (r, a) => [32 + r * Math.cos(a), 32 + r * squash * Math.sin(a)];
    const [ax, ay] = p(outer, a0);
    const [bx, by] = p(outer, a1);
    const [cx, cy] = p(inner, a1);
    const [dx, dy] = p(inner, a0);
    out.push(facet([ax, ay, bx, by, cx, cy, dx, dy], shades[i % shades.length]));
  }
  return out;
};

const CONCEPTS = [
  {
    id: "ridge",
    name: "Ridge",
    idea: "A rising mountain range, cut by vertical ridges. Reads as upside without a single arrow or chart line.",
    facets: [
      facet([26, 6, 26, 30, 13, 30], "bright"),
      facet([13, 30, 26, 30, 26, 56, 2, 56], "mid"),
      facet([26, 6, 40, 42, 40, 56, 26, 56], "warm"),
      facet([52, 18, 40, 42, 40, 56, 52, 56], "mid"),
      facet([52, 18, 52, 56, 62, 56], "deep"),
    ],
  },
  {
    id: "podium",
    name: "Podium",
    idea: "The finish, not the fight. Three blocks with the winner centred, each capped by a lit top slab.",
    facets: [
      facet([24, 16, 42, 16, 42, 23, 24, 23], "bright"),
      facet([24, 23, 42, 23, 42, 58, 24, 58], "warm"),
      facet([4, 31, 24, 31, 24, 38, 4, 38], "warm"),
      facet([4, 38, 24, 38, 24, 58, 4, 58], "mid"),
      facet([42, 39, 60, 39, 60, 46, 42, 46], "mid"),
      facet([42, 46, 60, 46, 60, 58, 42, 58], "deep"),
    ],
  },
  {
    id: "crown",
    name: "Crown",
    idea: "Three spikes on a band. The gaps between facets do the work, so the notches never need a stroke.",
    facets: [
      facet([8, 42, 15, 13, 23, 42], "warm"),
      facet([23, 42, 32, 4, 41, 42], "bright"),
      facet([41, 42, 49, 13, 56, 42], "mid"),
      facet([8, 42, 23, 42, 23, 57, 8, 57], "mid"),
      facet([23, 42, 41, 42, 41, 57, 23, 57], "warm"),
      facet([41, 42, 56, 42, 56, 57, 41, 57], "deep"),
    ],
  },
  {
    id: "bowl",
    name: "Bowl",
    idea: "The arena itself, seen from above and slightly tilted. Eight seating segments around an open floor.",
    facets: ring(8, 30, 15, 0.82, ["bright", "warm", "mid", "deep", "deep", "mid", "warm", "bright"], 22.5),
  },
  {
    id: "gem",
    name: "Gem",
    idea: "A brilliant cut, table to culet. The most literal reading of the metallic-facet language the family already speaks.",
    facets: [
      facet([22, 12, 42, 12, 46, 25, 18, 25], "bright"),
      facet([22, 12, 6, 25, 18, 25], "warm"),
      facet([42, 12, 58, 25, 46, 25], "mid"),
      facet([6, 25, 19, 25, 32, 58], "warm"),
      facet([19, 25, 32, 25, 32, 58], "bright"),
      facet([32, 25, 45, 25, 32, 58], "mid"),
      facet([45, 25, 58, 25, 32, 58], "deep"),
    ],
  },
  {
    id: "steps",
    name: "Steps",
    idea: "Four bars climbing left to right, each cut on the diagonal and lit a step brighter than the last.",
    facets: [
      ...bar(4, 15, 44, 58, "deep", "deep"),
      ...bar(18, 29, 34, 58, "mid", "deep"),
      ...bar(32, 43, 22, 58, "warm", "mid"),
      ...bar(46, 57, 8, 58, "bright", "warm"),
    ],
  },
  {
    id: "crest",
    name: "Crest",
    idea: "A shield quartered into four facets. Club-badge energy, which suits rooms and leagues.",
    facets: [
      facet([10, 8, 32, 8, 32, 32, 10, 32], "bright"),
      facet([32, 8, 54, 8, 54, 32, 32, 32], "warm"),
      facet([10, 32, 32, 32, 32, 58], "mid"),
      facet([32, 32, 54, 32, 32, 58], "deep"),
    ],
  },
  {
    id: "burst",
    name: "Burst",
    idea: "Eight spikes on alternating lengths around a cut centre. A star that is a compass rather than a rating.",
    facets: (() => {
      const out = [];
      const tips = [30, 21, 30, 21, 30, 21, 30, 21];
      const shades = ["bright", "warm", "mid", "warm", "deep", "mid", "warm", "bright"];
      for (let i = 0; i < 8; i++) {
        const at = ((i / 8) * 360 - 90) * (Math.PI / 180);
        const a0 = at - Math.PI / 8;
        const a1 = at + Math.PI / 8;
        const p = (r, a) => [32 + r * Math.cos(a), 32 + r * Math.sin(a)];
        out.push(facet([...p(tips[i], at), ...p(11, a1), ...p(11, a0)], shades[i]));
      }
      const oct = [];
      for (let i = 0; i < 8; i++) {
        const a = ((i / 8) * 360 + 22.5 - 90) * (Math.PI / 180);
        oct.push(32 + 10 * Math.cos(a), 32 + 10 * Math.sin(a));
      }
      out.push(facet(oct, "warm"));
      return out;
    })(),
  },
  {
    id: "cup",
    name: "Cup",
    idea: "A trophy, faceted rather than drawn. Warmest and most literal of the ten.",
    facets: [
      facet([14, 10, 32, 10, 32, 34, 20, 34], "warm"),
      facet([32, 10, 50, 10, 44, 34, 32, 34], "bright"),
      facet([15, 12, 4, 16, 10, 30, 15, 26], "mid"),
      facet([49, 12, 60, 16, 54, 30, 49, 26], "deep"),
      facet([27, 34, 37, 34, 36, 46, 28, 46], "mid"),
      facet([17, 48, 47, 48, 52, 58, 12, 58], "deep"),
    ],
  },
  {
    id: "turn",
    name: "Turn",
    idea: "Four blades in rotation. No summit, no letterform, pure motion, so it never collides with Lab's standing A.",
    facets: (() => {
      const blade = [32, 32, 32, 5, 50, 11, 45, 28];
      const shades = ["bright", "warm", "mid", "deep"];
      const out = [];
      for (let i = 0; i < 4; i++) {
        const b = rot(blade, i * 90);
        out.push(facet([b[0], b[1], b[2], b[3], b[4], b[5]], shades[i]));
        out.push(facet([b[0], b[1], b[4], b[5], b[6], b[7]], shades[(i + 1) % 4]));
      }
      return out;
    })(),
  },
];

const facetMarkup = (facets, scale = 0.93) =>
  facets
    .map(({ points, c: [cx, cy], shade }) =>
      `<polygon points="${points}" fill="url(#arena-${shade})" transform="translate(${r1(cx)} ${r1(cy)}) scale(${scale}) translate(${r1(-cx)} ${r1(-cy)})"/>`
    )
    .join("\n  ");

const svgFor = (concept) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENTS}</defs>
  ${facetMarkup(concept.facets)}
</svg>
`;

const outDir = path.join(process.cwd(), "docs", "brand", "concepts");
await mkdir(outDir, { recursive: true });
for (const c of CONCEPTS) {
  await writeFile(path.join(outDir, `${c.id}.svg`), svgFor(c));
}
await writeFile(path.join(outDir, "concepts.json"), JSON.stringify(
  CONCEPTS.map((c) => ({ id: c.id, name: c.name, idea: c.idea, svg: svgFor(c).trim() })), null, 2));

console.log(`Wrote ${CONCEPTS.length} concepts to docs/brand/concepts`);
