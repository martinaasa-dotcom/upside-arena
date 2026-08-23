/*
  Arena's mark, as data rather than as a component.

  The same drawing is used four ways: as React in the app, as a standalone SVG
  string for the share image, as the plated app-icon compositions, and as the
  icon rasters. Keeping the geometry in one place is what stops those drifting
  into four slightly different logos, and `scripts/generate-icons.mjs` imports
  this file directly rather than holding a second copy.

  What the mark is, and why, is recorded in docs/brand/ARENA_MARK.md. In short:
  two heavy peaks, a near one and a far one, parted by a hairline. Arena is a
  game you play against people you know, so the mark is a pair rather than a
  single object: one peak ahead, one behind, the way a week in the game
  actually looks.

  Related to Lab's mark by construction rather than by colour. Lab draws one
  peak -- a standing gold "A" cut into ten facets -- because Lab is your own
  portfolio and there is nobody else in it. Arena draws two. Same family,
  different story.

  It has two colourways, and which one is right depends on what it is sitting
  on. See COLOURWAYS below.
*/

export type Peak = {
  /** Apex, in the 64 grid. */
  apex: [number, number];
  /** Half-span at the baseline: the foot reaches `span` either side of the apex. */
  span: number;
  /** Where both feet sit. */
  baseline: number;
  /**
   * Leg width, measured horizontally at the baseline. Omitted for a solid
   * peak with no counter cut out of it.
   */
  leg?: number;
  /** Which of a colourway's two ramps it takes. */
  fill: "near" | "far";
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
  The near peak: taller, further left, and the one the eye lands on, so it
  takes whichever end of the ramp carries the most contrast.

  The legs are heavy -- 16 units either side of a 46-unit span -- so the mass
  is most of the drawing and the counter is a slot through it rather than the
  shape itself. They were half that at first, and the mark was two thin
  strokes floating in a tile: correct as a drawing, and on a home screen it
  read as a logo somebody had forgotten to finish.
*/
export const NEAR_PEAK: Peak = {
  apex: [24, 4],
  span: 23,
  baseline: 60,
  leg: 16,
  fill: "near",
};

/*
  The far peak: shorter, further right, lower in contrast, and solid.

  Solid is the whole difference between the two, and it is what makes the pair
  read at a glance. When the far peak also had a counter, the middle of the
  mark was four edges deep -- the near peak's slot, the far peak's slot, and
  the hairline between them -- and at any size below a poster it read as
  clutter rather than as depth. One aperture in the whole drawing is enough,
  and the peak without one is unmistakably the one behind.

  The two feet share a baseline; only the apexes differ, which is what makes
  the pair read as one drawing seen in depth rather than as two drawings side
  by side.
*/
export const FAR_PEAK: Peak = {
  apex: [44, 16],
  span: 19,
  baseline: 60,
  fill: "far",
};

/** Painting order: the far peak first, then the near one over it. */
export const MARK_PEAKS: Peak[] = [FAR_PEAK, NEAR_PEAK];

/** A peak's outline. The near one's is also the shape the hairline is cut with. */
export function peakPath(peak: Peak): string {
  const [ax, ay] = peak.apex;
  const { span, baseline, leg } = peak;
  if (leg == null) {
    return `M ${ax} ${ay} L ${ax + span} ${baseline} L ${ax - span} ${baseline} Z`;
  }
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

/** The icon canvas: the same 64 grid the mark is drawn on. */
export const ICON_BOX = 64;

/** The drawing's own box. It is centred exactly on the grid. */
export const MARK_BOX = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const peak of MARK_PEAKS) {
    for (const [, x, y] of peakPath(peak).matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
      xs.push(Number(x));
      ys.push(Number(y));
    }
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
})();

/** The tight viewBox, as the attribute string. */
export const MARK_VIEWBOX = `${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.width} ${MARK_BOX.height}`;

/*
  Where the ink actually balances, on the 64 grid.

  Two peaks are nearly all base: the apexes are points and almost every square
  unit of the drawing sits along the baseline, so the centre of area lands at
  y = 40.8, which is 8.8 units below the middle of the box the drawing is
  centred in. Sampled from the two outlines; the hairline cut takes a sliver
  off the far peak near the foot and moves this by under a tenth of a unit, so
  it is measured on the outlines rather than on one particular size.
  `tests/unit/lockup.test.ts` recomputes it, so a peak cannot move without the
  number following.
*/
export const MARK_CENTROID_Y = 40.8;

/*
  How far to lift the mark when it stands beside the type, as a fraction of
  the size it is drawn at.

  Centred by the numbers, the mark reads as having sagged: the ink is
  symmetric about the middle of its box, but its weight is not, and the eye
  splits the difference between the outline and the balance point. So the
  perceived centre is about half of those 8.8 units low, and lifting by half
  the offset -- 4.4 units, or 6.9% of the box -- puts it on the middle of the
  cap band. Nothing else is needed on a `items-center` row: Geist's caps are
  centred in a `leading-none` line box to within a twentieth of a pixel at
  header size, measured, so the row already lines the two boxes up.

  Half, not all of it. Lifting the centre of area itself onto the cap band
  puts the apex a long way over the caps with the feet at the baseline, and
  the mark stops reading as sitting on the line at all.

  It belongs to the lockup rather than to the mark, so `ArenaMark` stays
  centred in its own box: a drawing that is secretly off-centre fights every
  other place it is put. The plated icons carry their own, smaller lift for
  the same reason stated against a tile (`OPTICAL_LIFT`), because a tile is
  not a line of type.
*/
export const LOCKUP_LIFT =
  (MARK_CENTROID_Y - (MARK_BOX.y + MARK_BOX.height / 2)) / 2 / ICON_BOX;

/*
  The lockup's proportions, all of them against its unit (`size` on
  `ArenaWordmark`), so the whole thing scales as one object.

  `type` is 0.7, which is the 14px the header has always set at unit 20, and
  it does not move: the words are the fixed part of a lockup and the mark is
  what is measured against them.

  `mark` is **1.12, not 1**. At 1 the drawing's box was the unit, and since
  the ink is 56 of its 64 units tall, the mark stood 0.875 of the type size:
  beside Lab's, whose "A" stands a clean 1.4, Arena's read as the smaller of
  two sibling lockups rather than as the same one in another colour. At 1.12
  the ink is 1.4 times the type size exactly, so the two apps put the same
  amount of drawing beside the same amount of word. Matching Lab's *width*
  instead would take 1.43, and it is the wrong invariant: Lab draws one wide
  "A" (aspect 1.24) and Arena two upright peaks (1.11), so equal widths would
  leave Arena towering over the caps. A line of type is measured by height.

  `gap` is 0.5, a tenth up from the 0.4 that the smaller mark sat behind, and
  it is Lab's proportion: 10px against 14px type. The mark's own ink runs to
  within a unit of its box on both sides, so the gap on screen is the whole of
  this number and nothing is added back by the drawing.
*/
export const LOCKUP = {
  /** The mark's box. */
  mark: 1.12,
  /** The type's size. */
  type: 0.7,
  /** From the mark's box to the first letter. */
  gap: 0.5,
} as const;

export type Ramp = { from: string; to: string };
export type Colourway = {
  /** The plate under it, top to bottom. Null for the transparent mark. */
  plate: [string, string] | null;
  near: Ramp;
  far: Ramp;
};

/*
  Two colourways, and which one is right depends entirely on what the mark is
  sitting on.

  `MARK` is the app's. Aqua on the app's own true black, transparent, for the
  header lockup, the share card and anywhere the drawing is needed unplated.
  The near peak's lower stop is the accent's own lightness, so the mark and
  `--primary` read as the same colour rather than as two neighbours.

  `ICON` is the home screen's, and it is the reverse. A near-black tile is the
  wrong instinct for an app icon: put one in a grid beside the icons people
  actually have and it reads as a hole rather than as an app. Every icon in
  the register this has to survive -- Apple's own, and everything shipped
  against their guidance -- is a saturated field with a simple mark on it, so
  Arena's icon is the accent aqua as the *field*, with the peaks in an ink
  drawn from the same hue. The mark did not change; the ground did.

  Depth reverses with it. On black the near peak is the brightest thing and
  the far one recedes into the field; on aqua the near peak is the darkest and
  the far one is the one closer to the plate. Contrast is what says "in
  front", and it points the other way round on a light ground.
*/
export const COLOURWAYS: Record<"MARK" | "ICON", Colourway> = {
  MARK: {
    plate: null,
    near: { from: "#d0fbff", to: "#1ec8d0" },
    far: { from: "#00a6b4", to: "#00616f" },
  },
  ICON: {
    plate: ["#86eef7", "#0a7f96"],
    near: { from: "#032128", to: "#021216" },
    far: { from: "#083a45", to: "#04222a" },
  },
};

/** Where each ramp runs, in the 64 grid. Shared by both colourways. */
export const RAMP_AXES = {
  near: { x1: 2, y1: 2, x2: 48, y2: 60 },
  far: { x1: 24, y1: 12, x2: 64, y2: 60 },
} as const;

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

function gradientDefs(prefix: string, way: Colourway): string {
  return (["near", "far"] as const)
    .map((key) => {
      const axis = RAMP_AXES[key];
      const ramp = way[key];
      return (
        `<linearGradient id="${prefix}${key}" x1="${axis.x1}" y1="${axis.y1}" x2="${axis.x2}" y2="${axis.y2}" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0" stop-color="${ramp.from}"/><stop offset="1" stop-color="${ramp.to}"/></linearGradient>`
      );
    })
    .join("");
}

/*
  The cut, as a mask rather than as a second copy of the geometry.

  The far peak is painted through a mask that knocks out the near peak plus a
  `cut`-wide halo around it. Filling the gap with the plate colour instead
  would work on the icons and fail everywhere else: the bare mark is
  transparent, and the plate is a gradient, so there is no one colour to fill
  with. A mask cuts the same seam on black, on aqua and on nothing at all.
*/
function cutMask(id: string, cut: number): string {
  return (
    /*
      The mask box reaches well past the 64 grid. The near peak's foot sits at
      x = 1, and the outline is *stroked* to cut the hairline, so half the
      stroke falls outside the grid -- a mask clipped to 0..64 would trim that
      overhang and leave a nick of far peak showing through at the corner.
    */
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="-8" y="-8" width="80" height="80">` +
    `<rect x="-8" y="-8" width="80" height="80" fill="#fff"/>` +
    `<path d="${peakPath(NEAR_PEAK)}" fill="#000" stroke="#000" stroke-width="${cut}" stroke-linejoin="round"/>` +
    `</mask>`
  );
}

function peaksMarkup(prefix: string, maskId: string): string {
  return (
    `<path d="${peakPath(FAR_PEAK)}" fill="url(#${prefix}far)" mask="url(#${maskId})"/>` +
    `<path d="${peakPath(NEAR_PEAK)}" fill="url(#${prefix}near)"/>`
  );
}

/*
  How far to lift the drawing above the geometric centre of its plate, as a
  fraction of the plate.

  A pair of peaks is a triangular mass: nearly all of its area sits along the
  baseline and the apexes are points, so its perceived centre is below the
  middle of its bounding box. Centred by the numbers, it reads as having
  sagged.

  It applies to the plated icons only. The bare mark is placed by whatever is
  around it -- a flex row in the lockup, a host's own tile padding -- and a
  drawing that is secretly off-centre would fight all of them.
*/
const OPTICAL_LIFT = 0.02;

/** Scale the drawing about the centre of the grid, and lift it optically. */
function place(scale: number, inner: string, lift = 0): string {
  const dy = -(ICON_BOX * lift);
  const shift = dy === 0 ? "" : `translate(0 ${dy.toFixed(3)}) `;
  return `<g transform="${shift}translate(32 32) scale(${scale.toFixed(5)}) translate(-32 -32)">${inner}</g>`;
}

/**
 * The mark as a standalone SVG document, transparent, in the app's colourway.
 *
 * For the share image, which is rendered by a converter that treats SVG as an
 * image rather than as markup it can walk, and for `public/arena-mark.svg`.
 */
export function arenaMarkSvg(size = 64): string {
  const way = COLOURWAYS.MARK;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `<defs>${gradientDefs("a-", way)}${cutMask("a-cut", cutForSize(size))}</defs>` +
    peaksMarkup("a-", "a-cut") +
    `</svg>`
  );
}

/** The same, ready to drop into an img src. */
export function arenaMarkDataUri(size = 64): string {
  return `data:image/svg+xml;base64,${Buffer.from(arenaMarkSvg(size)).toString("base64")}`;
}

/*
  How much of the canvas the mark's **width** takes, and how hard the plate's
  own corners are cut. One entry per place an icon is actually consumed,
  because each of them crops differently and a single safe area would be wrong
  for all of them.

  A fraction of the width rather than a raw scale factor, because a scale says
  nothing about how close a foot lands to an edge.

  0.66 is not a compromise, it is the register. A centred symbol on an Apple
  icon runs between about half and two thirds of the tile -- Music's note is
  near 0.48, Messages' bubble near 0.64, Mail's envelope near 0.66 -- and the
  margin around it is doing as much work as the symbol. An earlier pass had
  this at 0.80 because bigger sounded better; in a grid beside real icons it
  read as crowded rather than as confident.
*/
export const ICON_PRESETS = {
  /*
    iOS, iPadOS, macOS and the App Store listing. Square and full-bleed: the
    system draws the squircle, so the file must not. Baking one in is what
    produces the double-rounded corner that says "exported from a website".
  */
  app: { radius: 0, glyph: 0.66 },
  /*
    Favicons, bookmark tiles and the PWA "any" icons. Nothing masks these, so
    the file carries its own rounded shape, and the mark can sit a little
    larger because nothing is going to crop it.
  */
  tile: { radius: 0.225, glyph: 0.7 },
  /*
    The true favicons, 16 to 48. Same shape as `tile` and a fuller mark,
    because these are the one place the icon is smaller than the thing it has
    to say. At 16px the plate is 16 pixels and the mark inside it is eleven;
    every one of them has to carry meaning, and the margin that makes a
    home-screen icon look composed is just wasted room here.
  */
  favicon: { radius: 0.225, glyph: 0.8 },
  /*
    Android's adaptive icons. The launcher crops to a circle of 80 percent of
    the side, and on some it is closer to a squircle, so the mark is pulled
    well inside that circle rather than to its edge.
  */
  maskable: { radius: 0, glyph: 0.52 },
  /*
    Google's OAuth consent dialogue: 120px, on a surface whose colour we do
    not control, cropped to a circle in some of Google's dialogues and left
    square in others. So it keeps its own rounded shape, and the mark sits
    inside the circle -- what has to fit a circular crop is the drawing's
    diagonal, not its width.
  */
  consent: { radius: 0.225, glyph: 0.54 },
} as const;

export type IconPreset = keyof typeof ICON_PRESETS;

/** A preset's scale factor: what `glyph` means once the mark's width is known. */
export function presetScale(preset: IconPreset): number {
  return (ICON_BOX * ICON_PRESETS[preset].glyph) / MARK_BOX.width;
}

/**
 * A plated app icon as a standalone SVG document, in the icon colourway.
 *
 * `size` is the pixel size it is about to be rasterised at, and is used for
 * the hairline cut as well as for the document's dimensions -- the drawing
 * stays on the 64 grid and the rasteriser scales it.
 */
export function arenaIconSvg(preset: IconPreset, size: number): string {
  const { radius, glyph } = ICON_PRESETS[preset];
  const way = COLOURWAYS.ICON;
  const plate = way.plate!;
  const rx = radius > 0 ? ` rx="${(ICON_BOX * radius).toFixed(2)}"` : "";
  /*
    The cut is set from the size the mark itself lands at, not from the size
    of the file: a 512px maskable icon draws the mark 33px wide on the grid,
    and asking it for a 512px cut would leave a hairline nobody can see.
  */
  const cut = cutForSize(size * glyph);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_BOX} ${ICON_BOX}" width="${size}" height="${size}">` +
    `<defs>` +
    /*
      One linear gradient, top to bottom, and nothing else. This used to be a
      radial field with a brand-hue lobe behind the mark and a magenta
      counter-lobe in the far corner -- the app's own ambient lighting, moved
      onto a 64px tile where it read as a smudge. An icon plate is a flat
      colour with a gentle fall, the way every icon it will sit beside is.
    */
    `<linearGradient id="a-plate" x1="0" y1="0" x2="0" y2="${ICON_BOX}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${plate[0]}"/><stop offset="1" stop-color="${plate[1]}"/>` +
    `</linearGradient>` +
    gradientDefs("a-", way) +
    cutMask("a-cut", cut) +
    `</defs>` +
    `<rect width="${ICON_BOX}" height="${ICON_BOX}"${rx} fill="url(#a-plate)"/>` +
    place(presetScale(preset), peaksMarkup("a-", "a-cut"), OPTICAL_LIFT) +
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
