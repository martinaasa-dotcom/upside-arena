/*
  Arena mark concepts, round three.

  Construction is unchanged from src/components/brand/ArenaMark.tsx: flat
  facets, no strokes, each facet scaled toward its own centroid so the cuts
  read as hairline gaps, all on the same 64 grid.

  Round three develops the two directions that survived review: Field, a grid
  of repeated units with one lit, and Split, one solid divided and offset so
  the gap becomes the subject. Both are systematic rather than symbolic, which
  is what the rejected rounds were not. Concepts 1 to 5 extend Field, 6 to 9
  extend Split, and 10 crosses them. Sapphire is the primary family; teal and
  emerald are generated alongside it as a palette study.
  Run with `node scripts/logo-concepts.mjs`.
*/
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

/*
  The warm family is Lab's, untouched. The cool family is built to match it
  step for step so the two read as the same milled metal in different alloys,
  which is what keeps a two-tone mark from looking like two stickers.
*/
/*
  Each family runs polished rim, lit face, body, shadow, so a facet cluster
  keeps the same light-to-dark logic the gold mark uses. The rim step is
  deliberately desaturated: a jewel reads as cut stone only if something on it
  catches light like metal.
*/
const PALETTES = {
  sapphire: {
    label: "Sapphire",
    note: "No collision with any semantic token. Furthest from Lab's gold while staying premium.",
    stops: [
      ["#d9e9ff", "#a9c8f0"],
      ["#6aa6f0", "#3f74c8"],
      ["#2d5cb5", "#1a3a84"],
      ["#17306b", "#0c1a3d"],
    ],
  },
  teal: {
    label: "Teal",
    note: "Sits beside --cat-1 and --cat-6, so it already belongs to the system. Coolest and calmest of the three.",
    stops: [
      ["#d4f4f2", "#a2ddd9"],
      ["#5fc9c4", "#34998f"],
      ["#1f8b86", "#12615f"],
      ["#0f4d4c", "#07302f"],
    ],
  },
  emerald: {
    label: "Emerald",
    note: "Richest of the three, but it lands on --gain green. A stock game whose logo reads as profit is a problem.",
    stops: [
      ["#d6f5e2", "#a3e0bd"],
      ["#4fd18c", "#2ba565"],
      ["#16904f", "#0b6537"],
      ["#0a4d2a", "#052e19"],
    ],
  },
};

const gradientsFor = (key) =>
  PALETTES[key].stops
    .map(([a, b], i) => {
      const [x2, y2] = i < 2 ? [0.6, 1] : [1, 1];
      const x1 = i < 2 ? 0 : 0.2;
      return `<linearGradient id="${key}-${i + 1}" x1="${x1}" y1="0" x2="${x2}" y2="${y2}">` +
        `<stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient>`;
    })
    .join("\n  ");

const r1 = (n) => Math.round(n * 100) / 100;

function facet(coords, shade) {
  const pts = [];
  for (let i = 0; i < coords.length; i += 2) pts.push([coords[i], coords[i + 1]]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { points: pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(" "), c: [cx, cy], shade };
}

const seg = (i, n, outer, inner, shade, squash = 1) => {
  const a0 = ((i / n) * 360 - 90) * (Math.PI / 180);
  const a1 = (((i + 1) / n) * 360 - 90) * (Math.PI / 180);
  const p = (r, a) => [32 + r * Math.cos(a), 32 + r * squash * Math.sin(a)];
  return facet([...p(outer, a0), ...p(outer, a1), ...p(inner, a1), ...p(inner, a0)], shade);
};

// A unit stone. Every Field-branch concept is built from these.
const diamond = (cx, cy, r, shade) =>
  facet([cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy], shade);

// Pointy-top hexagon, so a cluster tiles without gaps of its own.
const hexPoints = (cx, cy, r) => {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    out.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return out;
};

// Regular polygon vertex, used to cut the octagon concepts.
const poly = (n, r, i, cx = 32, cy = 32, offset = 0) => {
  const a = (((i / n) * 360 + offset) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

const CONCEPTS = [
  {
    id: "quorum",
    name: "Quorum",
    idea: "Seven stones packed as a honeycomb, one of them lit. Field's idea with a unit that tiles perfectly.",
    facets: (() => {
      const r = 9;
      const dx = Math.sqrt(3) * r;
      const cells = [
        [32, 32, 3], [32 - dx, 32, 4], [32 + dx, 32, 3],
        [32 - dx / 2, 32 - 1.5 * r, 4], [32 + dx / 2, 32 - 1.5 * r, 1],
        [32 - dx / 2, 32 + 1.5 * r, 4], [32 + dx / 2, 32 + 1.5 * r, 3],
      ];
      return cells.map(([cx, cy, shade]) => facet(hexPoints(cx, cy, r), shade));
    })(),
  },
  {
    id: "rank",
    name: "Rank",
    idea: "Six stones stacked into a wedge with the apex lit. Selection and standing in one shape, without drawing a podium.",
    facets: [
      diamond(32, 13, 7, 1),
      diamond(24, 29, 7, 3), diamond(40, 29, 7, 3),
      diamond(16, 45, 7, 4), diamond(32, 45, 7, 4), diamond(48, 45, 7, 4),
    ],
  },
  {
    id: "board",
    name: "Board",
    idea: "Sixteen stones with two lit side by side. The whole field of picks, and the one matchup that matters this week.",
    facets: (() => {
      const at = [11, 25, 39, 53];
      const lit = new Set(["25,25", "39,25"]);
      const out = [];
      for (const cy of at) {
        for (const cx of at) {
          const key = `${cx},${cy}`;
          out.push(diamond(cx, cy, 6, lit.has(key) ? (cx === 25 ? 1 : 2) : cy < 32 ? 4 : 3));
        }
      }
      return out;
    })(),
  },
  {
    id: "focus",
    name: "Focus",
    idea: "One lit stone ringed by six dark ones. Reads as the pick and the field around it at any size.",
    facets: (() => {
      const out = [diamond(32, 32, 9, 1)];
      for (let i = 0; i < 6; i++) {
        const [cx, cy] = poly(6, 20, i, 32, 32, 0);
        out.push(diamond(cx, cy, 7, i % 2 ? 4 : 3));
      }
      return out;
    })(),
  },
  {
    id: "drift",
    name: "Drift",
    idea: "Five stones climbing, each larger and brighter than the last. Field's unit carrying motion instead of a grid.",
    facets: [
      diamond(10, 52, 4, 4), diamond(20, 44, 5.5, 4), diamond(31, 35, 7, 3),
      diamond(43, 25, 8.5, 2), diamond(52, 15, 9, 1),
    ],
  },
  {
    id: "shear",
    name: "Shear",
    idea: "Split turned on its side. A six-sided stone cut across and slid, so both halves stay slabs instead of collapsing into triangles.",
    facets: [
      facet([38, 3, 58, 17, 58, 31, 38, 31], 1),
      facet([38, 3, 38, 31, 18, 31, 18, 17], 2),
      facet([6, 33, 26, 33, 26, 59, 6, 45], 3),
      facet([26, 33, 46, 33, 46, 45, 26, 59], 4),
    ],
  },
  {
    id: "cleave",
    name: "Cleave",
    idea: "An eight-sided stone parted along its diagonal, the halves sliding apart in opposite directions.",
    facets: (() => {
      const v = [];
      for (let i = 0; i < 8; i++) v.push(poly(8, 26, i, 32, 32, 22.5));
      const shift = (pt, dx, dy) => [pt[0] + dx, pt[1] + dy];
      const up = (pt) => shift(pt, 3, -3);
      const dn = (pt) => shift(pt, -3, 3);
      return [
        facet([...up(v[5]), ...up(v[6]), ...up(v[7])], 1),
        facet([...up(v[5]), ...up(v[7]), ...up(v[0]), ...up(v[1])], 2),
        facet([...dn(v[1]), ...dn(v[2]), ...dn(v[3])], 3),
        facet([...dn(v[1]), ...dn(v[3]), ...dn(v[4]), ...dn(v[5])], 4),
      ];
    })(),
  },
  {
    id: "trio",
    name: "Trio",
    idea: "One stone cut into three slabs and staggered. Split with a third part, so it reads as a field rather than a duel.",
    facets: [
      facet([8, 13, 24, 3.67, 24, 50.33, 8, 41], 1),
      facet([24, 12.67, 32, 8, 40, 12.67, 40, 32, 24, 32], 2),
      facet([24, 32, 40, 32, 40, 59.33, 32, 64, 24, 59.33], 3),
      facet([40, 3.67, 56, 13, 56, 41, 40, 50.33], 4),
    ],
  },
  {
    id: "rift",
    name: "Rift",
    idea: "Split pushed further, with both inner edges lit so the gap itself glows. The negative space is the mark.",
    facets: [
      facet([8, 16, 24, 6.4, 24, 57.6, 8, 48], 3),
      facet([24, 6.4, 28, 4, 28, 60, 24, 57.6], 1),
      facet([36, 4, 40, 6.4, 40, 57.6, 36, 60], 2),
      facet([40, 6.4, 56, 16, 56, 48, 40, 57.6], 4),
    ],
  },
  {
    id: "mosaic",
    name: "Mosaic",
    idea: "Field and Split crossed. Nine stones assembled into one larger stone, then broken along the diagonal.",
    facets: (() => {
      const rows = [
        [[32, 12]],
        [[26, 22], [38, 22]],
        [[19, 32], [32, 32], [45, 32]],
        [[26, 42], [38, 42]],
        [[32, 52]],
      ];
      const out = [];
      for (const row of rows) {
        for (const [cx, cy] of row) {
          const sum = cx + cy;
          const d = sum < 64 ? -2.5 : sum > 64 ? 2.5 : 0;
          const shade = sum === 64 ? 1 : sum < 64 ? 2 : 4;
          out.push(diamond(cx + d, cy + d, 6.5, shade));
        }
      }
      return out;
    })(),
  },
];

const facetMarkup = (facets, palette, scale = 0.93) =>
  facets
    .map(({ points, c: [cx, cy], shade }) =>
      `<polygon points="${points}" fill="url(#${palette}-${shade})" transform="translate(${r1(cx)} ${r1(cy)}) scale(${scale}) translate(${r1(-cx)} ${r1(-cy)})"/>`
    )
    .join("\n  ");

const svgFor = (concept, palette = "sapphire") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
  ${gradientsFor(palette)}</defs>
  ${facetMarkup(concept.facets, palette)}
</svg>
`;

const outDir = path.join(process.cwd(), "docs", "brand", "concepts");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
for (const c of CONCEPTS) await writeFile(path.join(outDir, `${c.id}.svg`), svgFor(c));

/*
  The palette study runs one silhouette through all three families, so the
  colour decision can be made independently of the shape decision.
*/
const STUDY_ON = "cleave";
const study = CONCEPTS.find((c) => c.id === STUDY_ON);
for (const key of Object.keys(PALETTES)) {
  await writeFile(path.join(outDir, `study-${key}.svg`), svgFor(study, key));
}

await writeFile(
  path.join(outDir, "concepts.json"),
  JSON.stringify(
    {
      palette: "sapphire",
      concepts: CONCEPTS.map((c) => ({ id: c.id, name: c.name, idea: c.idea, svg: svgFor(c).trim() })),
      study: Object.entries(PALETTES).map(([key, v]) => ({
        id: key,
        label: v.label,
        note: v.note,
        svg: svgFor(study, key).trim(),
      })),
    },
    null,
    2
  )
);

console.log(`Wrote ${CONCEPTS.length} concepts and ${Object.keys(PALETTES).length} palette studies`);
