/*
  Arena's mark, as data rather than as a component.

  The same facets are drawn three ways: as React for the app, as a standalone
  SVG string for the share image, and as the icon files. Keeping the geometry
  in one place is what stops the three drifting into three slightly different
  logos, which is exactly the failure the brand doc warns about.
*/

export type Facet = {
  points: string;
  centroid: [number, number];
  fill: string;
};

export const MARK_FACETS: Facet[] = [
  // Left cluster, dark tail up to bright apex.
  { points: "2,38 16,21 2,58", centroid: [6.67, 39.0], fill: "url(#arena-deep)" },
  { points: "16,21 16,41 2,58", centroid: [11.33, 40.0], fill: "url(#arena-mid)" },
  { points: "16,21 30,4 16,41", centroid: [20.67, 22.0], fill: "url(#arena-warm)" },
  { points: "30,4 30,24 16,41", centroid: [25.33, 23.0], fill: "url(#arena-bright)" },
  // Right cluster, mirrored and shaded in the opposite order.
  { points: "62,38 48,21 62,58", centroid: [57.33, 39.0], fill: "url(#arena-mid)" },
  { points: "48,21 48,41 62,58", centroid: [52.67, 40.0], fill: "url(#arena-deep)" },
  { points: "48,21 34,4 48,41", centroid: [43.33, 22.0], fill: "url(#arena-bright)" },
  { points: "34,4 34,24 48,41", centroid: [38.67, 23.0], fill: "url(#arena-warm)" },
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
  { id: "arena-bright", x1: "0", y1: "0", x2: "0.6", y2: "1", from: "#f7e8bb", to: "#d9c184" },
  { id: "arena-warm", x1: "0", y1: "0", x2: "0.7", y2: "1", from: "#e4cf94", to: "#c2a45f" },
  { id: "arena-mid", x1: "0.2", y1: "0", x2: "1", y2: "1", from: "#c9a659", to: "#a8813a" },
  { id: "arena-deep", x1: "0.2", y1: "0", x2: "1", y2: "1", from: "#a87c33", to: "#7d551d" },
];

/** The transform that scales a facet toward its own centroid, for the gaps. */
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
      `<polygon points="${facet.points}" fill="${facet.fill}" transform="${facetTransform(facet)}"/>`
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

  The app itself uses oklch. These are the conversions from the brand doc, for
  the two places that cannot do oklch: a mail client, and the converter that
  turns the share card into a PNG.
*/
export const HEX = {
  field: "#000000",
  card: "#171717",
  well: "#262626",
  foreground: "#fafafa",
  muted: "#a1a1a1",
  primary: "#d4bc79",
  primaryForeground: "#0a0a0a",
  gain: "#00bc7d",
  loss: "#f2435f",
} as const;
