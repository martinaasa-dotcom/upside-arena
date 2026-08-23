/*
  Arena's mark, as data rather than as a component.

  The same drawing is used four ways: as React in the app, as a standalone SVG
  string for the share image, as the plated app-icon compositions, and as the
  icon rasters. Keeping the geometry in one place is what stops those drifting
  into four slightly different logos, and `scripts/generate-icons.mjs` imports
  this file directly rather than holding a second copy.

  What the mark is, and why, is recorded in docs/brand/ARENA_MARK.md. In short:
  two peaks in aqua, a near one and a far one, parted by a hairline. Arena is a
  game you play against people you know, so the mark is a pair rather than a
  single object: one peak ahead, one behind, the way a week in the game
  actually looks.

  Related to Lab's mark by construction rather than by colour. Lab draws one
  peak, a solid gold "A", because Lab is your own portfolio and there is
  nobody else in it. Arena draws two, in aqua. Same family, different story.
*/

export type Peak = {
  /** Apex, in the 64 grid. */
  apex: [number, number];
  /** Half-span at the baseline: the foot reaches `span` either side of the apex. */
  span: number;
  /** Where both feet sit. */
  baseline: number;
  /** Leg width, measured horizontally at the baseline. */
  leg: number;
  /** The gradient it is filled with, by id. */
  fill: string;
};

/*
  How far down the notch between the legs runs, as a fraction of where it
  would fall if the inner edges were exactly parallel to the outer ones.

  At 1 the legs are a constant horizontal width and the peak reads blunt, like
  a tent. Below 1 the inner apex rides up, the legs thin toward the top, and
  the peak reads as a peak. 0.62 is as far as it goes before the legs start to
  look like two separate strokes that happen to meet.
*/
const INNER_APEX = 0.62;

/*
  The near peak: taller, further left, and the bright one. It is the one the
  eye lands on, so it takes the light.
*/
export const NEAR_PEAK: Peak = {
  apex: [24, 6],
  span: 19,
  baseline: 58,
  leg: 9.5,
  fill: "arena-near",
};

/*
  The far peak: shorter, further right, and darker, so it sits behind rather
  than beside. The two feet share a baseline; only the apexes differ, which is
  what makes the pair read as one drawing seen in depth rather than as two
  drawings side by side.
*/
export const FAR_PEAK: Peak = {
  apex: [42, 16],
  span: 17,
  baseline: 58,
  leg: 8.5,
  fill: "arena-far",
};

/** Painting order: the far peak first, then the near one over it. */
export const MARK_PEAKS: Peak[] = [FAR_PEAK, NEAR_PEAK];

/** The near peak's outline, which is also the shape the hairline is cut with. */
export function peakPath(peak: Peak): string {
  const [ax, ay] = peak.apex;
  const { span, baseline, leg } = peak;
  const inner = ay + ((leg * (baseline - ay)) / span) * INNER_APEX;
  return [
    `M ${ax} ${ay}`,
    `L ${ax + span} ${baseline}`,
    `L ${ax + span - leg} ${baseline}`,
    `L ${ax} ${inner.toFixed(2)}`,
    `L ${ax - span + leg} ${baseline}`,
    `L ${ax - span} ${baseline}`,
    "Z",
  ].join(" ");
}

export const MARK_GRADIENTS: {
  id: string;
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  from: string;
  to: string;
}[] = [
  /*
    One aqua ramp at the accent's hue, split across the two peaks rather than
    across facets. The near peak runs from a near-white rim down to the
    accent's own lightness, so the mark and `--primary` read as the same
    colour. The far peak runs two steps below it, far enough to sit back on
    the true-black field without disappearing into it.

    Both are stated in sRGB because a raster pipeline and a mail client cannot
    do oklch. The oklch they came from is in docs/brand/ARENA_MARK.md.
  */
  {
    id: "arena-near",
    x1: "6",
    y1: "6",
    x2: "46",
    y2: "58",
    from: "#d0fbff",
    to: "#1ec8d0",
  },
  {
    id: "arena-far",
    x1: "26",
    y1: "16",
    x2: "60",
    y2: "58",
    from: "#00a6b4",
    to: "#00616f",
  },
];

/*
  How wide to cut the hairline that parts the two peaks, given the size the
  mark will actually be drawn at.

  This is an optical-size decision rather than a constant, and it runs the
  opposite way to instinct: the cut has to get *wider* in grid units as the
  drawing gets smaller, because what matters is that it survives as roughly a
  pixel on screen. At 512px a 1.6-unit cut is a crisp 13px seam. At 16px that
  same 1.6 units is a fifth of a pixel, anti-aliasing eats it, and the two
  peaks fuse into one blob with a smudge down the middle -- which is exactly
  how a mark stops reading as two things.

  The floor keeps the seam a deliberate hairline at poster sizes instead of
  vanishing; the ceiling stops it opening into a canyon on a 16px favicon.
*/
export function cutForSize(size: number): number {
  return Math.min(4, Math.max(1.6, 70 / size));
}

/*
  How much of the 64 grid the bare mark fills. The drawing is 54 wide and 52
  tall inside a 64 grid, and in a browser tab or a bookmark tile the host adds
  padding of its own on top of that, which leaves an unzoomed mark looking
  lost. The plated compositions below set their own scale instead, because
  there the padding is the safe area and is not the host's to add.
*/
export const MARK_ZOOM = 1.1;

function gradientDefs(): string {
  return MARK_GRADIENTS.map(
    (g) =>
      `<linearGradient id="${g.id}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient>`
  ).join("");
}

/*
  The cut, as a mask rather than as a second copy of the geometry.

  The far peak is painted through a mask that knocks out the near peak plus a
  `cut`-wide halo around it. Filling the gap with the plate colour instead
  would work on the icons and fail everywhere else: the bare mark is
  transparent, and the plate is a gradient, so there is no one colour to fill
  with. A mask cuts the same seam on black, on white and on nothing at all.
*/
function cutMask(id: string, cut: number): string {
  return (
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">` +
    `<rect width="64" height="64" fill="#fff"/>` +
    `<path d="${peakPath(NEAR_PEAK)}" fill="#000" stroke="#000" stroke-width="${cut}" stroke-linejoin="round"/>` +
    `</mask>`
  );
}

function peaksMarkup(maskId: string): string {
  return (
    `<path d="${peakPath(FAR_PEAK)}" fill="url(#${FAR_PEAK.fill})" mask="url(#${maskId})"/>` +
    `<path d="${peakPath(NEAR_PEAK)}" fill="url(#${NEAR_PEAK.fill})"/>`
  );
}

/** Scale the drawing about the centre of the 64 grid. */
function zoom(scale: number, inner: string): string {
  return `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${inner}</g>`;
}

/**
 * The mark as a standalone SVG document, transparent.
 *
 * For the share image, which is rendered by a converter that treats SVG as an
 * image rather than as markup it can walk, and for `public/arena-mark.svg`.
 */
export function arenaMarkSvg(size = 64): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `<defs>${gradientDefs()}${cutMask("arena-cut", cutForSize(size))}</defs>` +
    zoom(MARK_ZOOM, peaksMarkup("arena-cut")) +
    `</svg>`
  );
}

/** The same, ready to drop into an img src. */
export function arenaMarkDataUri(size = 64): string {
  return `data:image/svg+xml;base64,${Buffer.from(arenaMarkSvg(size)).toString("base64")}`;
}

/*
  The plate the app icon is drawn on.

  Full-bleed, opaque, and lit from the same two directions the app itself is:
  the near lobe in the accent aqua at the top left, the far one in the magenta
  counter-accent at the bottom right. An icon that is lit like the product is
  what makes the home screen and the app feel like one thing.

  There is no baked drop shadow and no baked corner radius on the square
  shape, because iOS, iPadOS and macOS all apply their own mask and their own
  lighting on top. Baking either in is what produces the double-rounded corner
  and the shadow-inside-a-shadow that says "this icon was exported from a
  website".
*/
export const PLATE = {
  /** The field, top-left to bottom-right. */
  field: ["#0d1c20", "#000000"],
  /** The near lobe, behind the mark. */
  glow: "#11c0d3",
  glowOpacity: 0.3,
  /** The far lobe, the counter-accent. */
  counter: "#e380e0",
  counterOpacity: 0.12,
} as const;

/*
  How big the mark is drawn inside its plate, and how hard the plate's own
  corners are cut. One entry per place an icon is actually consumed, because
  each of them crops differently and a single safe area would be wrong for all
  of them.
*/
export const ICON_PRESETS = {
  /*
    iOS, iPadOS, macOS and the App Store listing. Square and full-bleed: the
    system draws the squircle, so the file must not. 0.8 puts the mark inside
    the concentric safe area Apple's icon grid reserves, with room for the
    mask to take the corners without touching a foot.
  */
  app: { radius: 0, glyph: 0.8 },
  /*
    Favicons, bookmark tiles and the PWA "any" icons. Nothing masks these, so
    the file carries its own rounded shape, and the mark can sit larger
    because nothing is going to crop it.
  */
  tile: { radius: 0.225, glyph: 0.88 },
  /*
    Android's adaptive icons. The launcher crops to a circle of 80 percent of
    the side, and on some it is closer to a squircle, so the mark is pulled
    well inside that circle rather than to its edge.
  */
  maskable: { radius: 0, glyph: 0.56 },
  /*
    Google's OAuth consent dialogue: 120px, on a surface whose colour we do
    not control, cropped to a circle in some of Google's dialogues and left
    square in others. So it keeps its own plate and its own rounded shape, and
    the mark sits inside the circle -- but less inset than Android's, which
    reserves more room than Google needs and would leave the mark looking lost
    in the middle of a 120px tile.
  */
  consent: { radius: 0.225, glyph: 0.66 },
} as const;

export type IconPreset = keyof typeof ICON_PRESETS;

/**
 * A plated app icon as a standalone SVG document.
 *
 * `size` is the pixel size it is about to be rasterised at, and is used for
 * the hairline cut rather than for the document's own dimensions -- the
 * document stays on the 64 grid and the rasteriser scales it.
 */
export function arenaIconSvg(preset: IconPreset, size: number): string {
  const { radius, glyph } = ICON_PRESETS[preset];
  const rx = radius > 0 ? ` rx="${(64 * radius).toFixed(2)}"` : "";
  const cut = cutForSize(size * glyph);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `<defs>` +
    `<radialGradient id="arena-field" cx="0.26" cy="0.14" r="1">` +
    `<stop offset="0" stop-color="${PLATE.field[0]}"/><stop offset="1" stop-color="${PLATE.field[1]}"/>` +
    `</radialGradient>` +
    `<radialGradient id="arena-glow" cx="0.5" cy="0.5" r="0.52">` +
    `<stop offset="0" stop-color="${PLATE.glow}" stop-opacity="${PLATE.glowOpacity}"/>` +
    `<stop offset="1" stop-color="${PLATE.glow}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="arena-counter" cx="0.9" cy="0.94" r="0.62">` +
    `<stop offset="0" stop-color="${PLATE.counter}" stop-opacity="${PLATE.counterOpacity}"/>` +
    `<stop offset="1" stop-color="${PLATE.counter}" stop-opacity="0"/>` +
    `</radialGradient>` +
    gradientDefs() +
    cutMask("arena-cut", cut) +
    `</defs>` +
    `<rect width="64" height="64"${rx} fill="url(#arena-field)"/>` +
    `<rect width="64" height="64"${rx} fill="url(#arena-counter)"/>` +
    `<rect width="64" height="64"${rx} fill="url(#arena-glow)"/>` +
    zoom(glyph, peaksMarkup("arena-cut")) +
    `</svg>`
  );
}

/*
  The locked palette, in sRGB.

  The app itself uses oklch. These are the conversions, for the two places
  that cannot do oklch: a mail client, and the converter that turns the share
  card into a PNG. Keep in step with src/app/globals.css, which is the source
  of truth.
*/
export const HEX = {
  field: "#000000",
  card: "#171717",
  well: "#262626",
  foreground: "#fafafa",
  muted: "#a1a1a1",
  /*
    The accent, oklch(0.74 0.125 207). The mark's aqua, held at the one
    lightness every accent in the app shares. See docs/brand/ARENA_MARK.md.
  */
  primary: "#11c0d3",
  /*
    The counter-accent, oklch(0.74 0.17 328). Lights the far side of the
    ambient field. 121 degrees off the accent, so it still reads as an
    opposite, and clear of every semantic hue by at least 44 degrees.
  */
  glowSecondary: "#e380e0",
  primaryForeground: "#0a0a0a",
  gain: "#20c88d",
  loss: "#fd7e88",
} as const;

/** The accent as rgb components, for the ambient field's near lobe. */
export const PRIMARY_RGB = "17, 192, 211";

/** The counter-accent, for the ambient field's far lobe. */
export const SECONDARY_RGB = "227, 128, 224";
