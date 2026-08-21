/*
  Renders the Arena mark to the raster sizes the PWA manifest, favicon and
  social card need. Run with `npm run icons` after changing ArenaMark.tsx.
  Facet geometry is kept in step with src/components/brand/ArenaMark.tsx.
*/
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const FACETS = [
  { points: "2,38 16,21 2,58", centroid: [6.67, 39.0], fill: "arena-deep" },
  { points: "16,21 16,41 2,58", centroid: [11.33, 40.0], fill: "arena-mid" },
  { points: "16,21 30,4 16,41", centroid: [20.67, 22.0], fill: "arena-warm" },
  { points: "30,4 30,24 16,41", centroid: [25.33, 23.0], fill: "arena-bright" },
  { points: "62,38 48,21 62,58", centroid: [57.33, 39.0], fill: "arena-mid" },
  { points: "48,21 48,41 62,58", centroid: [52.67, 40.0], fill: "arena-deep" },
  { points: "48,21 34,4 48,41", centroid: [43.33, 22.0], fill: "arena-bright" },
  { points: "34,4 34,24 48,41", centroid: [38.67, 23.0], fill: "arena-warm" },
];

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

function facetMarkup(scale = 0.93) {
  return FACETS.map(({ points, centroid: [cx, cy], fill }) =>
    `<polygon points="${points}" fill="url(#${fill})" transform="translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})"/>`
  ).join("\n  ");
}

// Transparent mark, for favicons and any-purpose icons.
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENTS}</defs>
  ${facetMarkup()}
</svg>`;

/*
  Maskable icons get a true-black plate and the mark pulled into the safe
  zone, so Android's circular crop never clips a facet.
*/
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENTS}</defs>
  <rect width="64" height="64" fill="#000000"/>
  <g transform="translate(32 32) scale(0.62) translate(-32 -32)">
    ${facetMarkup()}
  </g>
</svg>`;

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    ${GRADIENTS}
    <radialGradient id="glow-a" cx="0" cy="0" r="1">
      <stop offset="0%" stop-color="#d4bc79" stop-opacity="0.5"/>
      <stop offset="66%" stop-color="#d4bc79" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-b" cx="1" cy="1" r="1">
      <stop offset="0%" stop-color="#d4bc79" stop-opacity="0.14"/>
      <stop offset="72%" stop-color="#d4bc79" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#000000"/>
  <rect width="1200" height="630" fill="url(#glow-a)"/>
  <rect width="1200" height="630" fill="url(#glow-b)"/>
  <g transform="translate(96 232) scale(1.75)">${facetMarkup()}</g>
  <text x="222" y="300" font-family="Geist, ui-sans-serif, system-ui, sans-serif"
        font-size="44" letter-spacing="3" fill="#fafafa">
    <tspan font-weight="700">UPSIDE</tspan><tspan font-weight="400"> ARENA</tspan>
  </text>
  <text x="98" y="392" font-family="Geist, ui-sans-serif, system-ui, sans-serif"
        font-size="52" font-weight="600" letter-spacing="-1.3" fill="#fafafa">
    Pick stocks with friends. Play money only.
  </text>
  <text x="98" y="452" font-family="Geist, ui-sans-serif, system-ui, sans-serif"
        font-size="30" fill="#a1a1a1">
    A free weekly stock-picking game. Nothing real is ever at stake.
  </text>
</svg>`;

const outDir = path.join(process.cwd(), "public");
await mkdir(path.join(outDir, "icons"), { recursive: true });

await writeFile(path.join(outDir, "arena-mark.svg"), markSvg);

for (const size of [16, 32, 48, 180, 192, 512]) {
  await sharp(Buffer.from(markSvg), { density: 512 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, "icons", `icon-${size}.png`));
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(maskableSvg), { density: 512 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, "icons", `maskable-${size}.png`));
}

await sharp(Buffer.from(markSvg), { density: 512 })
  .resize(32, 32)
  .toFormat("png")
  .toFile(path.join(outDir, "favicon.png"));

await sharp(Buffer.from(ogSvg), { density: 192 })
  .resize(1200, 630)
  .png()
  .toFile(path.join(outDir, "og.png"));

console.log("Icons written to public/icons, public/favicon.png, public/og.png");
