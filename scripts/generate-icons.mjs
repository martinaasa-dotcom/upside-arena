/*
  Renders the Arena mark to every raster the product actually ships: the
  favicons, the Apple touch icon, the PWA manifest icons, Google's OAuth
  consent tile, the App Store master and the social card.

  Run with `npm run icons` after changing src/lib/brand/mark.ts.

  The geometry is imported from that file rather than copied here. It used to
  be copied, with a comment asking the next person to keep the two in step,
  and the two were one edit away from being different logos at all times.
  Node strips the types on import, so there is exactly one drawing.
*/
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import {
  HEX,
  arenaIconSvg,
  arenaMarkSvg,
} from "../src/lib/brand/mark.ts";

const outDir = path.join(process.cwd(), "public");
const iconDir = path.join(outDir, "icons");

/*
  Each icon SVG declares its own width and height in pixels, so at the default
  72 DPI the rasteriser draws it at exactly the target size. Asking for more
  and scaling back down is supersampling, and it is what keeps the long
  diagonals of the peaks from stairstepping at favicon sizes.

  Four times over for the small icons, twice for the large ones: the App Store
  master is 1024px, and four times that is a 16-megapixel intermediate for no
  visible gain.
*/
function densityFor(size) {
  return 72 * (size <= 256 ? 4 : 2);
}

/** An opaque icon: no alpha channel at all, which is what Apple requires. */
async function opaque(svg, size, file) {
  await sharp(Buffer.from(svg), { density: densityFor(size) })
    .resize(size, size)
    .removeAlpha()
    .png()
    .toFile(file);
  return file;
}

/** A shaped icon: keeps its alpha, because the rounded corners are its own. */
async function shaped(svg, size, file) {
  const buf = await sharp(Buffer.from(svg), { density: densityFor(size) })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(file, buf);
  return buf;
}

/*
  PNG-in-ICO, so a browser asking for /favicon.ico by habit gets the mark
  rather than a 404. Two entries, 16 and 32: Windows and every browser in use
  picks the nearest, and the sizes above that are served as PNG by the
  <link rel="icon"> list in the document head.
*/
function packIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const table = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((entry, i) => {
    const at = i * 16;
    table.writeUInt8(entry.size >= 256 ? 0 : entry.size, at);
    table.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
    table.writeUInt16LE(1, at + 4);
    table.writeUInt16LE(32, at + 6);
    table.writeUInt32LE(entry.data.length, at + 8);
    table.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  });
  return Buffer.concat([header, table, ...entries.map((e) => e.data)]);
}

/*
  The social card is product chrome rather than the mark, so it is composed
  here rather than in the brand module. Its ambient field follows the app: the
  near lobe in the accent aqua, the far one in the magenta counter-accent.

  The headline is set on two lines because the card is rasterised with
  whatever sans the build host happens to have rather than with Geist, and one
  long line overflowed 1200px under the fallback metrics.
*/
const SANS = "Geist, ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif";

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <radialGradient id="og-near" cx="0" cy="0" r="1">
      <stop offset="0%" stop-color="${HEX.primary}" stop-opacity="0.34"/>
      <stop offset="66%" stop-color="${HEX.primary}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="og-far" cx="1" cy="1" r="1">
      <stop offset="0%" stop-color="${HEX.glowSecondary}" stop-opacity="0.20"/>
      <stop offset="72%" stop-color="${HEX.glowSecondary}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${HEX.field}"/>
  <rect width="1200" height="630" fill="url(#og-near)"/>
  <rect width="1200" height="630" fill="url(#og-far)"/>
  <g transform="translate(94 168)">${arenaMarkSvg(112)}</g>
  <text x="228" y="248" font-family="${SANS}" font-size="38" letter-spacing="2.5" fill="${HEX.foreground}">
    <tspan font-weight="700">UPSIDE</tspan><tspan font-weight="400" dx="14">ARENA</tspan>
  </text>
  <text x="98" y="392" font-family="${SANS}" font-size="50" font-weight="600" letter-spacing="-1.3" fill="${HEX.foreground}">
    Pick stocks with friends.
  </text>
  <text x="98" y="450" font-family="${SANS}" font-size="50" font-weight="600" letter-spacing="-1.3" fill="${HEX.foreground}">
    Play money only.
  </text>
  <text x="98" y="512" font-family="${SANS}" font-size="28" fill="${HEX.muted}">
    A free weekly stock-picking game. Nothing real is ever at stake.
  </text>
</svg>`;

await mkdir(iconDir, { recursive: true });

const written = [];

/*
  The bare mark, transparent, for anywhere the app needs the drawing without a
  plate. Authored at the large-size cut, since an SVG scales rather than
  rasterises and the browser will draw it at whatever size the page asks for.
*/
await writeFile(path.join(outDir, "arena-mark.svg"), arenaMarkSvg(512));
written.push("public/arena-mark.svg");

/*
  Favicons and bookmark tiles. Nothing masks these, so they carry their own
  rounded shape, and the cut is set from the size each one is written at.
*/
const tiles = {};
for (const size of [16, 32, 48, 192, 512]) {
  tiles[size] = await shaped(
    arenaIconSvg("tile", size),
    size,
    path.join(iconDir, `icon-${size}.png`)
  );
  written.push(`public/icons/icon-${size}.png`);
}

await writeFile(path.join(outDir, "favicon.png"), tiles[32]);
written.push("public/favicon.png");

await writeFile(
  path.join(outDir, "favicon.ico"),
  packIco([
    { size: 16, data: tiles[16] },
    { size: 32, data: tiles[32] },
  ])
);
written.push("public/favicon.ico");

/*
  The Apple touch icon and the App Store master. Square, full-bleed and with
  no alpha: iOS draws the squircle itself, and an icon that arrives already
  rounded gets rounded twice.
*/
for (const size of [180, 1024]) {
  await opaque(
    arenaIconSvg("app", size),
    size,
    path.join(iconDir, `icon-${size}.png`)
  );
  written.push(`public/icons/icon-${size}.png`);
}

/* Android adaptive icons: full-bleed, and the mark well inside the crop. */
for (const size of [192, 512]) {
  await opaque(
    arenaIconSvg("maskable", size),
    size,
    path.join(iconDir, `maskable-${size}.png`)
  );
  written.push(`public/icons/maskable-${size}.png`);
}

/* Google's OAuth consent dialogue. */
await shaped(
  arenaIconSvg("consent", 120),
  120,
  path.join(iconDir, "consent-120.png")
);
written.push("public/icons/consent-120.png");

await sharp(Buffer.from(ogSvg), { density: 192 })
  .resize(1200, 630)
  .removeAlpha()
  .png()
  .toFile(path.join(outDir, "og.png"));
written.push("public/og.png");

console.log(written.map((f) => `wrote ${f}`).join("\n"));
