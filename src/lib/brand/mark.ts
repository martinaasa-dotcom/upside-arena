/*
  Arena's mark, as data rather than as a component.

  The same stone is drawn three ways: as React for the app, as a standalone
  SVG string for the share image, and as the icon rasters. Keeping the
  geometry in one place is what stops the three drifting into three slightly
  different logos.

  What the mark is, and why, is recorded in docs/brand/ARENA_MARK.md. In
  short: one eight-sided stone parted along its diagonal, cut from aqua, with
  the lit half in front and the shadowed half falling away behind the cut.
  Related to Lab's mark by construction rather than by colour.
*/

export type Facet = {
  points: string;
  centroid: [number, number];
  /** The gradient it is filled with, by id. */
  fill: string;
};

/*
  An octagon of radius 26 about (32, 32), rotated 22.5deg so the stone sits
  flat, then parted along the diagonal by 1.5 in each direction. Kept in step
  with scripts/generate-icons.mjs, which rasterises the same shape.
*/
export const MARK_FACETS: Facet[] = [
  // Upper half: the rim catches the light, the lit face carries the stone.
  {
    points: "23.55,6.48 43.45,6.48 57.52,20.55",
    centroid: [41.51, 11.17],
    fill: "arena-rim",
  },
  {
    points: "23.55,6.48 57.52,20.55 57.52,40.45 43.45,54.52",
    centroid: [45.51, 30.5],
    fill: "arena-lit",
  },
  // Lower half: falls away behind the cut.
  {
    points: "40.45,57.52 20.55,57.52 6.48,43.45",
    centroid: [22.49, 52.83],
    fill: "arena-body",
  },
  {
    points: "40.45,57.52 6.48,43.45 6.48,23.55 20.55,9.48",
    centroid: [18.49, 33.5],
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
  // The rim step is deliberately desaturated: a jewel only reads as cut stone
  // if something on it catches light like metal.
  { id: "arena-rim", x1: "0", y1: "0", x2: "0.6", y2: "1", from: "#d9f7ff", to: "#a6e4f2" },
  { id: "arena-lit", x1: "0", y1: "0", x2: "0.6", y2: "1", from: "#4fd0e0", to: "#2a9fb5" },
  { id: "arena-body", x1: "0.2", y1: "0", x2: "1", y2: "1", from: "#17879c", to: "#0d6070" },
  { id: "arena-shadow", x1: "0.2", y1: "0", x2: "1", y2: "1", from: "#0b4a58", to: "#052e36" },
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
    The accent, oklch(0.79 0.113 207). This is the mark's own lit face, so
    the chrome and the logo are the same aqua rather than two colours chosen
    to sit near each other. See docs/brand/ARENA_MARK.md.
  */
  primary: "#4ad0dd",
  /*
    The counter-accent, oklch(0.68 0.19 328). Lights the far side of the
    ambient field. 121 degrees off the accent, so it still reads as an
    opposite, and clear of every semantic hue by at least 44 degrees.
  */
  glowSecondary: "#d466d2",
  primaryForeground: "#0a0a0a",
  gain: "#00bc7d",
  loss: "#f2435f",
} as const;

/** The accent as rgb components, for the ambient field's near lobe. */
export const PRIMARY_RGB = "74, 208, 221";

/** The counter-accent, for the ambient field's far lobe. */
export const SECONDARY_RGB = "212, 102, 210";
