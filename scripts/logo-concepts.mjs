/*
  Arena mark concepts, round two.

  Construction is unchanged from src/components/brand/ArenaMark.tsx: flat
  facets, no strokes, each facet scaled toward its own centroid so the cuts
  read as hairline gaps, all on the same 64 grid.

  What changed is the palette and the idea. The marks are cut from a jewel
  family rather than Lab's warm gold, and every silhouette is about a
  relationship between two parts rather than a trophy shape. Sapphire is the
  primary family; teal and emerald are generated alongside it as a palette
  study. Run with `node scripts/logo-concepts.mjs`.
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

const CONCEPTS = [
  {
    id: "clash",
    name: "Clash",
    idea: "A big wedge and a smaller one driving past each other. Deliberately unequal, because a matchup rarely is.",
    facets: [
      facet([4, 6, 34, 24, 34, 28, 4, 28], 1),
      facet([4, 28, 34, 28, 34, 32, 4, 52], 2),
      facet([60, 26, 30, 36, 30, 39, 60, 42], 3),
      facet([60, 42, 30, 39, 30, 42, 60, 58], 4),
    ],
  },
  {
    id: "split",
    name: "Split",
    idea: "One stone cut down the middle and pulled apart. Same shape twice, offset, with the gap doing the talking.",
    facets: [
      facet([31, 3, 31, 27, 9, 16], 1),
      facet([31, 27, 31, 51, 9, 38, 9, 16], 2),
      facet([33, 9, 55, 22, 33, 33], 3),
      facet([33, 33, 55, 22, 55, 44, 33, 57], 4),
    ],
  },
  {
    id: "bracket",
    name: "Bracket",
    idea: "Two brackets facing off. The empty middle is the floor, so the mark frames whatever sits in it.",
    facets: [
      facet([5, 8, 19, 8, 19, 56, 5, 56], 2),
      facet([19, 8, 31, 8, 31, 22, 19, 22], 1),
      facet([19, 42, 31, 42, 31, 56, 19, 56], 3),
      facet([45, 8, 59, 8, 59, 56, 45, 56], 4),
      facet([33, 8, 45, 8, 45, 22, 33, 22], 3),
      facet([33, 42, 45, 42, 45, 56, 33, 56], 4),
    ],
  },
  {
    id: "cross",
    name: "Cross",
    idea: "Two blades crossing, the cool one passing behind. The only concept here with real depth in it.",
    facets: [
      facet([56, 8, 52, 4, 6, 48, 10, 52], 3),
      facet([56, 8, 10, 52, 14, 56, 60, 12], 4),
      facet([8, 8, 12, 4, 58, 48, 54, 52], 1),
      facet([8, 8, 54, 52, 50, 56, 4, 12], 2),
    ],
  },
  {
    id: "pivot",
    name: "Pivot",
    idea: "A scale caught mid tip. Nobody has won yet, which is the state a live round is actually in.",
    facets: [
      facet([6, 34, 32, 24, 32, 36, 8, 46], 2),
      facet([32, 24, 58, 14, 58, 26, 32, 36], 1),
      facet([32, 30, 32, 58, 14, 58], 4),
      facet([32, 30, 50, 58, 32, 58], 3),
    ],
  },
  {
    id: "orbit",
    name: "Orbit",
    idea: "Two arcs chasing each other round a common centre. Neither one leads, and the gaps read as motion.",
    facets: [
      seg(0, 8, 30, 18, 1), seg(1, 8, 30, 18, 2), seg(2, 8, 30, 18, 2),
      seg(4, 8, 30, 18, 3), seg(5, 8, 30, 18, 4), seg(6, 8, 30, 18, 4),
    ],
  },
  {
    id: "field",
    name: "Field",
    idea: "Nine stones, one lit. The only concept that shows what a player actually does, which is pick one out of many.",
    facets: (() => {
      const shades = [4, 3, 1, 3, 4, 3, 4, 3, 4];
      const out = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const cx = 16 + col * 16;
          const cy = 16 + row * 16;
          out.push(facet([cx, cy - 8, cx + 8, cy, cx, cy + 8, cx - 8, cy], shades[row * 3 + col]));
        }
      }
      return out;
    })(),
  },
  {
    id: "fracture",
    name: "Fracture",
    idea: "A single diamond broken along a lightning seam. The break is jagged, so the two halves can never be swapped.",
    facets: [
      facet([32, 4, 40, 22, 24, 40, 6, 32], 1),
      facet([6, 32, 24, 40, 32, 60], 2),
      facet([32, 4, 58, 32, 40, 22], 3),
      facet([40, 22, 58, 32, 32, 60, 24, 40], 4),
    ],
  },
  {
    id: "trade",
    name: "Trade",
    idea: "Two arrows passing in opposite directions. Reads as a swap, a matchup and a market all at once.",
    facets: [
      facet([8, 14, 46, 14, 46, 26, 8, 26], 2),
      facet([46, 10, 60, 20, 46, 30], 1),
      facet([18, 38, 56, 38, 56, 50, 18, 50], 4),
      facet([18, 34, 4, 44, 18, 54], 3),
    ],
  },
  {
    id: "contest",
    name: "Contest",
    idea: "A cool ring with a warm stone held inside it. The only one that shows the arena and the player at once.",
    facets: [
      seg(0, 8, 30, 22, 3), seg(1, 8, 30, 22, 3), seg(2, 8, 30, 22, 4),
      seg(3, 8, 30, 22, 4), seg(4, 8, 30, 22, 4), seg(5, 8, 30, 22, 4),
      seg(6, 8, 30, 22, 3), seg(7, 8, 30, 22, 3),
      facet([32, 18, 44, 32, 32, 32], 1),
      facet([32, 32, 44, 32, 32, 46], 2),
      facet([32, 18, 32, 32, 20, 32], 1),
      facet([32, 32, 32, 46, 20, 32], 2),
    ],
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
const STUDY_ON = "fracture";
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
