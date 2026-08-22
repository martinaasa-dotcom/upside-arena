/*
  Arena mark concepts, round four.

  Round three narrowed to two: Quorum, a honeycomb of stones with one lit, and
  Cleave, a solid parted along its diagonal. Both are hexagonal, faceted and
  systematic, so this round treats them as one family and works inside it.
  Concepts 1 to 5 develop Quorum, 6 to 9 develop Cleave with the tighter gap
  the review asked for, and 10 crosses them.

  Construction is still exactly ArenaMark.tsx: flat facets, no strokes, each
  facet scaled toward its own centroid, all on the 64 grid. The palette is now
  a teal family, with two neighbouring teals generated as a study.
  Run with `node scripts/logo-concepts.mjs`.
*/
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

/*
  Each family runs polished rim, lit face, body, shadow. The rim stays
  desaturated: a jewel only reads as cut stone if something on it catches
  light like metal.
*/
const PALETTES = {
  teal: {
    label: "Teal",
    note: "The primary. Sits beside --cat-1 and --cat-6, so it already belongs to the system.",
    stops: [["#d4f4f2", "#a2ddd9"], ["#5fc9c4", "#34998f"], ["#1f8b86", "#12615f"], ["#0f4d4c", "#07302f"]],
  },
  aqua: {
    label: "Aqua",
    note: "The same teal pushed toward cyan. Brighter and more game-like, and it holds up better at 16px.",
    stops: [["#d9f7ff", "#a6e4f2"], ["#4fd0e0", "#2a9fb5"], ["#17879c", "#0d6070"], ["#0b4a58", "#052e36"]],
  },
  petrol: {
    label: "Petrol",
    note: "Teal pulled toward blue and darkened. Quietest of the three, and the closest in mood to Lab's gold.",
    stops: [["#cfe6e8", "#9cc4c9"], ["#4d9fa8", "#2b7580"], ["#175f6b", "#0c414b"], ["#093139", "#041d22"]],
  },
};

const gradientsFor = (key) =>
  PALETTES[key].stops
    .map(([a, b], i) => {
      const x1 = i < 2 ? 0 : 0.2;
      const [x2, y2] = i < 2 ? [0.6, 1] : [1, 1];
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

// Pointy-top hexagon, so a cluster tiles without gaps of its own.
const hexPoints = (cx, cy, r) => {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    out.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return out;
};

const poly = (n, r, i, cx = 32, cy = 32, offset = 0) => {
  const a = (((i / n) * 360 + offset) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

// The seven centres every Quorum-branch concept is built on.
const cluster = (r) => {
  const dx = Math.sqrt(3) * r;
  const dy = 1.5 * r;
  return [
    [32, 32], [32 - dx, 32], [32 + dx, 32],
    [32 - dx / 2, 32 - dy], [32 + dx / 2, 32 - dy],
    [32 - dx / 2, 32 + dy], [32 + dx / 2, 32 + dy],
  ];
};

/*
  Cleave, parameterised by gap. Round three shipped gap 3, which read as two
  stones rather than one parted stone; 1.5 keeps the cut visible without
  letting the halves drift apart.
*/
const cleaveFacets = (gap) => {
  const v = [];
  for (let i = 0; i < 8; i++) v.push(poly(8, 26, i, 32, 32, 22.5));
  const up = (p) => [p[0] + gap, p[1] - gap];
  const dn = (p) => [p[0] - gap, p[1] + gap];
  return [
    facet([...up(v[5]), ...up(v[6]), ...up(v[7])], 1),
    facet([...up(v[5]), ...up(v[7]), ...up(v[0]), ...up(v[1])], 2),
    facet([...dn(v[1]), ...dn(v[2]), ...dn(v[3])], 3),
    facet([...dn(v[1]), ...dn(v[3]), ...dn(v[4]), ...dn(v[5])], 4),
  ];
};

const CONCEPTS = [
  {
    id: "quorum",
    name: "Quorum",
    idea: "Seven stones packed as a honeycomb with one lit at the edge. Unchanged from round three except the metal.",
    facets: cluster(9).map(([cx, cy], i) =>
      facet(hexPoints(cx, cy, 9), [3, 4, 3, 4, 1, 4, 3][i])),
  },
  {
    id: "pack",
    name: "Pack",
    idea: "The same seven stones with the cuts tightened, so the cluster reads as one solid before it reads as seven.",
    scale: 0.965,
    facets: cluster(9).map(([cx, cy], i) =>
      facet(hexPoints(cx, cy, 9), [3, 4, 3, 4, 1, 4, 3][i])),
  },
  {
    id: "hive",
    name: "Hive",
    idea: "The light moved to the centre. Reads as the pick surrounded by the field rather than one stone standing out of it.",
    facets: cluster(9).map(([cx, cy], i) =>
      facet(hexPoints(cx, cy, 9), [1, 4, 3, 4, 3, 3, 4][i])),
  },
  {
    id: "break",
    name: "Break",
    idea: "One stone pushed out of formation and lit. The gap it leaves is the whole idea.",
    facets: cluster(9).map(([cx, cy], i) => {
      const out = i === 4;
      return facet(hexPoints(cx + (out ? 5 : 0), cy + (out ? -4 : 0), 9), [3, 4, 4, 4, 1, 4, 3][i]);
    }),
  },
  {
    id: "triad",
    name: "Triad",
    idea: "Three large stones instead of seven small ones. The boldest version of the honeycomb, and the only one that stays clean at 16px.",
    facets: [
      facet(hexPoints(21, 23, 13), 1),
      facet(hexPoints(43, 23, 13), 3),
      facet(hexPoints(32, 42, 13), 4),
    ],
  },
  {
    id: "cleave",
    name: "Cleave",
    idea: "Round three's Cleave with the gap halved. The halves stay one stone instead of drifting into two.",
    facets: cleaveFacets(1.5),
  },
  {
    id: "facet",
    name: "Facet",
    idea: "The same parting on a six-sided stone, so the silhouette agrees with the honeycomb concepts above.",
    facets: (() => {
      const v = [[32, 4], [56.2, 18], [56.2, 46], [32, 60], [7.8, 46], [7.8, 18]];
      // Offset runs along the normal to the v1-v4 seam, so the halves part rather than slide.
      const up = (p) => [p[0] - 0.75, p[1] - 1.3];
      const dn = (p) => [p[0] + 0.75, p[1] + 1.3];
      return [
        facet([...up(v[4]), ...up(v[5]), ...up(v[0])], 1),
        facet([...up(v[4]), ...up(v[0]), ...up(v[1])], 2),
        facet([...dn(v[1]), ...dn(v[2]), ...dn(v[3])], 3),
        facet([...dn(v[1]), ...dn(v[3]), ...dn(v[4])], 4),
      ];
    })(),
  },
  {
    id: "twist",
    name: "Twist",
    idea: "The halves rotated apart rather than slid. The cut opens like a hinge, which reads as motion without an arrow.",
    facets: (() => {
      const v = [];
      for (let i = 0; i < 8; i++) v.push(poly(8, 26, i, 32, 32, 22.5));
      const spin = (p, deg) => {
        const a = (deg * Math.PI) / 180;
        const dx = p[0] - 32;
        const dy = p[1] - 32;
        return [32 + dx * Math.cos(a) - dy * Math.sin(a), 32 + dx * Math.sin(a) + dy * Math.cos(a)];
      };
      const up = (p) => spin(p, -5);
      const dn = (p) => spin(p, 5);
      return [
        facet([...up(v[5]), ...up(v[6]), ...up(v[7])], 1),
        facet([...up(v[5]), ...up(v[7]), ...up(v[0]), ...up(v[1])], 2),
        facet([...dn(v[1]), ...dn(v[2]), ...dn(v[3])], 3),
        facet([...dn(v[1]), ...dn(v[3]), ...dn(v[4]), ...dn(v[5])], 4),
      ];
    })(),
  },
  {
    id: "chip",
    name: "Chip",
    idea: "One corner struck off a whole stone. The smallest possible cut, and the one that survives shrinking best.",
    facets: (() => {
      const v = [];
      for (let i = 0; i < 8; i++) v.push(poly(8, 26, i, 32, 32, 22.5));
      const off = (p) => [p[0] + 3, p[1] - 3];
      return [
        facet([...off(v[5]), ...off(v[6]), ...off(v[7])], 1),
        facet([...v[7], ...v[0], ...v[1], ...v[5]], 2),
        facet([...v[1], ...v[2], ...v[3], ...v[5]], 3),
        facet([...v[3], ...v[4], ...v[5]], 4),
      ];
    })(),
  },
  {
    id: "quarry",
    name: "Quarry",
    idea: "The honeycomb itself parted along the diagonal, with the stone on the seam left lit. Both directions in one mark.",
    facets: cluster(9).map(([cx, cy]) => {
      const sum = cx + cy;
      const d = sum < 63.5 ? -2 : sum > 64.5 ? 2 : 0;
      const shade = d === 0 ? 1 : d < 0 ? 3 : 4;
      return facet(hexPoints(cx + d, cy + d, 9), shade);
    }),
  },
];

const facetMarkup = (facets, palette, scale = 0.93) =>
  facets
    .map(({ points, c: [cx, cy], shade }) =>
      `<polygon points="${points}" fill="url(#${palette}-${shade})" transform="translate(${r1(cx)} ${r1(cy)}) scale(${scale}) translate(${r1(-cx)} ${r1(-cy)})"/>`
    )
    .join("\n  ");

const wrap = (facets, palette, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
  ${gradientsFor(palette)}</defs>
  ${facetMarkup(facets, palette, scale)}
</svg>
`;

const svgFor = (concept, palette = "teal") => wrap(concept.facets, palette, concept.scale ?? 0.93);

const outDir = path.join(process.cwd(), "docs", "brand", "concepts");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
for (const c of CONCEPTS) await writeFile(path.join(outDir, `${c.id}.svg`), svgFor(c));

// How far apart the halves should sit, shown rather than argued about.
const GAPS = [0.75, 1.5, 2.25, 3];
for (const g of GAPS) {
  await writeFile(path.join(outDir, `gap-${String(g).replace(".", "-")}.svg`), wrap(cleaveFacets(g), "teal"));
}

const STUDY_ON = "cleave";
const study = CONCEPTS.find((c) => c.id === STUDY_ON);
for (const key of Object.keys(PALETTES)) {
  await writeFile(path.join(outDir, `study-${key}.svg`), svgFor(study, key));
}

await writeFile(
  path.join(outDir, "concepts.json"),
  JSON.stringify(
    {
      palette: "teal",
      concepts: CONCEPTS.map((c) => ({ id: c.id, name: c.name, idea: c.idea, svg: svgFor(c).trim() })),
      gaps: GAPS.map((g) => ({ gap: g, svg: wrap(cleaveFacets(g), "teal").trim() })),
      study: Object.entries(PALETTES).map(([key, v]) => ({
        id: key, label: v.label, note: v.note, svg: svgFor(study, key).trim(),
      })),
    },
    null,
    2
  )
);

console.log(`Wrote ${CONCEPTS.length} concepts, ${GAPS.length} gap steps, ${Object.keys(PALETTES).length} palette studies`);
