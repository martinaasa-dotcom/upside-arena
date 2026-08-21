/*
  Renders the Arena mark to the raster sizes the PWA manifest, favicon and
  social card need. Run with `npm run icons` after changing ArenaMark.tsx.
  Facet geometry is kept in step with src/components/brand/ArenaMark.tsx.
*/
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const FACETS = [
  { points: "7.8,18 32,4 32,10 7.8,28", centroid: [19.9, 15], fill: "arena-lit" },
  { points: "32,4 56.2,18 56.2,28 32,10", centroid: [44.1, 15], fill: "arena-body" },
  { points: "7.8,42 32,24 32,60 7.8,46", centroid: [19.9, 43], fill: "arena-rim" },
  { points: "32,24 56.2,42 56.2,46 32,60", centroid: [44.1, 43], fill: "arena-shadow" },
];

/*
  Kept in step with src/lib/brand/mark.ts, including its rules: the cut follows
  the size the mark is drawn at, because a hairline that reads as a facet edge
  at 512px is a pixel of mud at 16, and the whole drawing is lifted slightly so
  it fills the tile rather than floating in it.
*/
const MARK_ZOOM = 1.08;

function cutForSize(size) {
  if (size >= 96) return 0.93;
  if (size >= 40) return 0.96;
  return 0.99;
}

const GRADIENTS = `
  <linearGradient id="arena-rim" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0%" stop-color="#cdf8fe"/><stop offset="100%" stop-color="#60ebfc"/>
  </linearGradient>
  <linearGradient id="arena-lit" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0%" stop-color="#2cd1e4"/><stop offset="100%" stop-color="#25b5c6"/>
  </linearGradient>
  <linearGradient id="arena-body" x1="0.2" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#198d9a"/><stop offset="100%" stop-color="#106d77"/>
  </linearGradient>
  <linearGradient id="arena-shadow" x1="0.2" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#07545d"/><stop offset="100%" stop-color="#00383e"/>
  </linearGradient>`;

function facetMarkup(cut) {
  return FACETS.map(({ points, centroid: [cx, cy], fill }) =>
    `<polygon points="${points}" fill="url(#${fill})" transform="translate(${cx} ${cy}) scale(${cut}) translate(${-cx} ${-cy})"/>`
  ).join("\n  ");
}

const markSvgAt = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENTS}</defs>
  <g transform="translate(32 32) scale(${MARK_ZOOM}) translate(-32 -32)">
    ${facetMarkup(cutForSize(size))}
  </g>
</svg>`;

// Transparent mark, for favicons and any-purpose icons. The source SVG is
// authored at the large-size cut, since it scales rather than rasterises.
const markSvg = markSvgAt(512);

/*
  Maskable icons get a true-black plate and the mark pulled into the safe
  zone, so Android's circular crop never clips a facet.
*/
const maskableSvgAt = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENTS}</defs>
  <rect width="64" height="64" fill="#000000"/>
  <g transform="translate(32 32) scale(0.62) translate(-32 -32)">
    ${facetMarkup(cutForSize(size * 0.62))}
  </g>
</svg>`;

/*
  The social card is product chrome, so its ambient field follows the app:
  the near lobe in --primary aqua, the far one in the magenta counter-accent.
  Headline is set on two lines:
  the card is rendered with whatever sans the build host has, and one long
  line overflowed 1200px under the fallback metrics.
*/
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    ${GRADIENTS}
    <radialGradient id="glow-a" cx="0" cy="0" r="1">
      <stop offset="0%" stop-color="#11c0d3" stop-opacity="0.34"/>
      <stop offset="66%" stop-color="#11c0d3" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-b" cx="1" cy="1" r="1">
      <stop offset="0%" stop-color="#e380e0" stop-opacity="0.20"/>
      <stop offset="72%" stop-color="#e380e0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#000000"/>
  <rect width="1200" height="630" fill="url(#glow-a)"/>
  <rect width="1200" height="630" fill="url(#glow-b)"/>
  <g transform="translate(96 214) scale(1.55)">${facetMarkup(cutForSize(512))}</g>
  <text x="212" y="278" font-family="Geist, ui-sans-serif, system-ui, sans-serif"
        font-size="38" letter-spacing="2.5" fill="#fafafa">
    <tspan font-weight="700">UPSIDE</tspan><tspan font-weight="400" dx="14">ARENA</tspan>
  </text>
  <text x="98" y="392" font-family="Geist, ui-sans-serif, system-ui, sans-serif"
        font-size="50" font-weight="600" letter-spacing="-1.3" fill="#fafafa">
    Pick stocks with friends.
  </text>
  <text x="98" y="450" font-family="Geist, ui-sans-serif, system-ui, sans-serif"
        font-size="50" font-weight="600" letter-spacing="-1.3" fill="#fafafa">
    Play money only.
  </text>
  <text x="98" y="512" font-family="Geist, ui-sans-serif, system-ui, sans-serif"
        font-size="28" fill="#a1a1a1">
    A free weekly stock-picking game. Nothing real is ever at stake.
  </text>
</svg>`;

const outDir = path.join(process.cwd(), "public");
await mkdir(path.join(outDir, "icons"), { recursive: true });

await writeFile(path.join(outDir, "arena-mark.svg"), markSvg);

for (const size of [16, 32, 48, 180, 192, 512]) {
  await sharp(Buffer.from(markSvgAt(size)), { density: 512 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, "icons", `icon-${size}.png`));
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(maskableSvgAt(size)), { density: 512 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, "icons", `maskable-${size}.png`));
}

await sharp(Buffer.from(markSvgAt(32)), { density: 512 })
  .resize(32, 32)
  .toFormat("png")
  .toFile(path.join(outDir, "favicon.png"));

await sharp(Buffer.from(ogSvg), { density: 192 })
  .resize(1200, 630)
  .png()
  .toFile(path.join(outDir, "og.png"));

console.log("Icons written to public/icons, public/favicon.png, public/og.png");
