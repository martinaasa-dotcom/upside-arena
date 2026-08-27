/**
 * The signed-out hero must paint in one frame, both lamps together.
 *
 * There is no bitmap to preload. The two halves of the hero are two radial
 * gradients, and they used to live on a document-tall SVG-filtered layer.
 * WebKit tiles that filter; the cyan top painted and the magenta half only
 * rasterized once the reader scrolled. These checks are against the source
 * because the failure is a CSS shape, not a render of the settled page.
 *
 * Upside Lab has the same split and the same guard. The two apps are one
 * design, so fix both or neither.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/app/globals.css", "utf8");
const LANDING = readFileSync("src/components/SignedOutLanding.tsx", "utf8");

function ruleOf(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  expect(start, `${selector} is missing from globals.css`).toBeGreaterThan(-1);
  return CSS.slice(start, CSS.indexOf("}", start));
}

describe("the landing hero lamps paint as one first-screen layer", () => {
  it("boxes the dithered pair to one screen, not the document", () => {
    const rule = ruleOf(".landing-field::before");
    expect(rule).toContain("height: 100svh");
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("url(#ambient-dither)");
    expect(rule).toContain("translateZ(0)");
    expect(rule).toContain("overflow: hidden");
    expect(rule).toContain("contain: paint");
    expect(rule).toContain("-webkit-backface-visibility");
    expect(rule).not.toMatch(/^\s*display:\s*none/m);
  });

  it("does not SVG-filter the page-tall layer", () => {
    const start = CSS.indexOf(".landing-field::after {");
    expect(start).toBeGreaterThan(-1);
    const rule = CSS.slice(start, CSS.indexOf("}", start));
    expect(rule).not.toContain("url(#ambient-dither)");
    expect(rule).not.toMatch(/^\s*filter:/m);
  });

  it("keeps both first-screen lamps on the inherited page-frame pair", () => {
    const start = CSS.indexOf(".page-frame::before {");
    expect(start).toBeGreaterThan(-1);
    const rule = CSS.slice(start, CSS.indexOf("}", start) + 1);
    expect(rule).toContain("--primary");
    expect(rule).toContain("--glow-secondary");
  });
});

describe("the landing does not hide itself before paint", () => {
  it("does not run the entrance animation on the hero", () => {
    expect(CSS).toMatch(/\.landing-field \.rise[\s\S]*?animation:\s*none/);
  });

  it("asks WebKit to paint the sample card, not skip it", () => {
    expect(LANDING).toContain("landing-still");
    expect(LANDING).toContain("landing-hero");
    const start = CSS.indexOf(".landing-hero,");
    expect(start).toBeGreaterThan(-1);
    const rule = CSS.slice(start, CSS.indexOf("}", start));
    expect(rule).toContain("content-visibility: visible");
    expect(rule).toMatch(/transform:\s*none/);
    expect(rule).not.toMatch(/transform:\s*translateZ/);
  });

  it("does not SVG-filter the sample-card glow, which hangs past the fold", () => {
    const start = CSS.indexOf(".landing-field .ambient-glow {");
    expect(start).toBeGreaterThan(-1);
    const rule = CSS.slice(start, CSS.indexOf("}", start));
    expect(rule).toMatch(/filter:\s*none/);
  });

  it("drops backdrop-filter on the phone landing, so the card cannot fill in", () => {
    expect(CSS).toMatch(
      /@media \(max-width: 767px\) \{[\s\S]*?\.landing-field \.glass,[\s\S]*?backdrop-filter:\s*none/
    );
  });
});
