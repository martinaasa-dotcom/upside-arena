/*
  Arena's mark, as data rather than as a component.

  The same stone is drawn three ways: as React for the app, as a standalone
  SVG string for the share image, and as the icon rasters. Keeping the
  geometry in one place is what stops the three drifting into three slightly
  different logos.

  What the mark is, and why, is recorded in docs/brand/ARENA_MARK.md. In
  short: one six-sided stone with a chevron channel cut clean through it, in
  aqua. The channel is the mark; the stone is only there to hold it, which is
  why the two masses are shaded as one object rather than as a pair.

  Related to Lab's mark by construction rather than by colour: same flat
  facets, same 64 grid, same centroid-scaled cuts, different silhouette and
  different metal.
*/

export type Facet = {
  points: string;
  centroid: [number, number];
  /** The gradient it is filled with, by id. */
  fill: string;
};

/*
  A pointy-top hexagon of radius 28 about (32, 32), with an upward chevron
  channel cut through it: the channel's upper edge runs (7.8,30) to (32,12) to
  (56.2,30), its lower edge (7.8,40) to (32,22) to (56.2,40). That leaves an
  upper band notched from beneath and a lower mass peaked on top. Each is split
  at the centre line so the cut-stone shading has something to work with.

  Kept in step with scripts/generate-icons.mjs, which rasterises the same shape.
*/
export const MARK_FACETS: Facet[] = [
  // Upper band, lit from the left.
  {
    points: "7.8,18 32,4 32,12 7.8,30",
    centroid: [19.9, 16],
    fill: "arena-lit",
  },
  {
    points: "32,4 56.2,18 56.2,30 32,12",
    centroid: [44.1, 16],
    fill: "arena-body",
  },
  // Lower mass. The rim catches the light along its left flank.
  {
    points: "7.8,40 32,22 32,60 7.8,46",
    centroid: [19.9, 42],
    fill: "arena-rim",
  },
  {
    points: "32,22 56.2,40 56.2,46 32,60",
    centroid: [44.1, 42],
    fill: "arena-shadow",
  },
];

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
    One aqua ramp at hue 207, four steps. The lit step is the accent's own
    lightness, so the mark and --primary read as the same colour rather than
    two neighbours. The rim is deliberately desaturated: a stone reads as cut
    only if something on it catches light like metal.
  */
  { id: "arena-rim", x1: "0", y1: "0", x2: "0.6", y2: "1", from: "#cdf8fe", to: "#60ebfc" },
  { id: "arena-lit", x1: "0", y1: "0", x2: "0.6", y2: "1", from: "#2cd1e4", to: "#25b5c6" },
  { id: "arena-body", x1: "0.2", y1: "0", x2: "1", y2: "1", from: "#198d9a", to: "#106d77" },
  { id: "arena-shadow", x1: "0.2", y1: "0", x2: "1", y2: "1", from: "#07545d", to: "#00383e" },
];

/** The transform that scales a facet toward its own centroid, for the cuts. */
export function facetTransform(facet: Facet) {
  const [cx, cy] = facet.centroid;
  return `translate(${cx} ${cy}) scale(0.93) translate(${-cx} ${-cy})`;
}

/**
 * The mark as a standalone SVG document.
 *
 * For the share image, which is rendered by a converter that treats SVG as an
 * image rather than as markup it can walk.
 */
export function arenaMarkSvg(size = 64): string {
  const defs = MARK_GRADIENTS.map(
    (gradient) =>
      `<linearGradient id="${gradient.id}" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}">` +
      `<stop offset="0%" stop-color="${gradient.from}"/>` +
      `<stop offset="100%" stop-color="${gradient.to}"/>` +
      `</linearGradient>`
  ).join("");

  const facets = MARK_FACETS.map(
    (facet) =>
      `<polygon points="${facet.points}" fill="url(#${facet.fill})" transform="${facetTransform(facet)}"/>`
  ).join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `<defs>${defs}</defs>${facets}</svg>`
  );
}

/** The same, ready to drop into an img src. */
export function arenaMarkDataUri(size = 64): string {
  return `data:image/svg+xml;base64,${Buffer.from(arenaMarkSvg(size)).toString("base64")}`;
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
    The counter-accent, oklch(0.68 0.19 328). Lights the far side of the
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
