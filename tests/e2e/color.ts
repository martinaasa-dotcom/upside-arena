/*
  Colour helpers for the brand tests.

  Chromium serialises a registered custom property as lab() but keeps a
  literal oklch() as written, so comparing token strings is meaningless.
  Both are pushed through a canvas instead, which yields concrete sRGB bytes
  whatever syntax went in.
*/

/** Runs in the page. Resolves any CSS colour string to [r, g, b, a]. */
export const resolveColorInPage = `(value) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#000000";
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data);
}`;

/** sRGB byte triple to an OKLCH hue in degrees. */
export function oklchHue([r, g, b]: number[]) {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.hypot(a, bb);
  if (chroma < 0.01) return null; // Grey has no meaningful hue.

  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  return hue < 0 ? hue + 360 : hue;
}
