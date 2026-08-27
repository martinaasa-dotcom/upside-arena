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
const SIGNIN = readFileSync("src/components/SignInCard.tsx", "utf8");
const MARK = readFileSync("src/components/brand/ArenaMark.tsx", "utf8");
const LAYOUT = readFileSync("src/app/layout.tsx", "utf8");
const PAGE = readFileSync("src/app/page.tsx", "utf8");
const SW = readFileSync("src/components/ServiceWorker.tsx", "utf8");

function ruleOf(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  expect(start, `${selector} is missing from globals.css`).toBeGreaterThan(-1);
  return CSS.slice(start, CSS.indexOf("}", start));
}

describe("the landing hero lamps paint as one first-screen layer", () => {
  it("boxes the dithered pair to one screen, not the document", () => {
    const rule = ruleOf(".landing-field::before");
    expect(rule.indexOf("height: 100vh")).toBeGreaterThan(-1);
    expect(rule.indexOf("height: 100svh")).toBeGreaterThan(
      rule.indexOf("height: 100vh")
    );
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("url(#ambient-dither)");
    expect(rule).toContain("translateZ(0)");
    expect(rule).toContain("overflow: hidden");
    expect(rule).toContain("contain: paint");
    expect(rule).toContain("-webkit-backface-visibility");
    expect(rule).toContain("z-index: -1");
    expect(rule).toContain("pointer-events: none");
    expect(rule).not.toMatch(/^\s*display:\s*none/m);
  });

  it("does not SVG-filter the page-tall layer", () => {
    const start = CSS.indexOf(".landing-field::after {");
    expect(start).toBeGreaterThan(-1);
    const rule = CSS.slice(start, CSS.indexOf("}", start));
    expect(rule).not.toContain("url(#ambient-dither)");
    expect(rule).not.toMatch(/^\s*filter:/m);
    // Extra stop so the undithered lobes band less. Three of them, all 48%.
    expect(rule.match(/48%/g)?.length).toBe(3);
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
    expect(LANDING).not.toMatch(/\brise\b/);
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
      /@media \(max-width: 767px\), \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\.landing-field \.glass,[\s\S]*?backdrop-filter:\s*none/
    );
    /*
      Unlayered, next to `.landing-field .rise`. The same selectors used
      to live inside `@layer components`, where a utility can beat them.
    */
    const glow = CSS.indexOf(".landing-field .ambient-glow");
    const drop = CSS.indexOf(".landing-field .glass,");
    expect(glow, "the unlayered glow rule is missing").toBeGreaterThan(-1);
    expect(drop, "the backdrop drop moved back into the layer").toBeGreaterThan(
      glow
    );
  });

  it("does not fade sections in on scroll", () => {
    expect(LANDING).not.toContain("IntersectionObserver");
    expect(LANDING).not.toContain("data-reveal");
    expect(LANDING).not.toContain("ARRIVE_LEAD");
    expect(CSS).not.toContain("[data-reveal]");
  });

  it("drops backdrop-filter on the landing's fixed notice too", () => {
    expect(CSS).toMatch(
      /\.landing-field ~ \.glass-notice[\s\S]*?backdrop-filter:\s*none/
    );
  });
});

describe("the landing has no bitmap to decode", () => {
  /*
    Same architecture as Lab. The hero is type, an inline SVG lockup, and
    CSS stills. There is no WebP or AVIF to fall back from, and nothing
    whose `loading` could steal the first paint. These fail if a raster
    lands on this page without the attributes Chrome and Safari need.
  */
  it("uses no <img>, next/image, or compressed raster on the page", () => {
    expect(LANDING).not.toMatch(/<img\b/);
    expect(LANDING).not.toContain("next/image");
    expect(LANDING).not.toMatch(/\.(webp|avif|jpe?g|png)\b/i);
    expect(LANDING).not.toContain("loading=");
    expect(SIGNIN).not.toMatch(/<img\b/);
    expect(SIGNIN).not.toContain("loading=");
  });

  it("sizes the lockup and the Google mark in attributes, so the box is reserved", () => {
    expect(MARK).toContain("width={size}");
    expect(MARK).toContain("height={size}");
    expect(SIGNIN).toMatch(/width=\{20\}/);
    expect(SIGNIN).toMatch(/height=\{20\}/);
  });

  it("stops iOS from autolinking numbers after first paint", () => {
    expect(LAYOUT).toMatch(/formatDetection:\s*\{[\s\S]*telephone:\s*false/);
    expect(LAYOUT).toMatch(/email:\s*false/);
    expect(LAYOUT).toMatch(/address:\s*false/);
  });

  it("sizes the hero against svh, so the address bar cannot grow it", () => {
    const hero = ruleOf(".landing-hero");
    expect(hero.indexOf("min-height: calc(100vh - 9rem)")).toBeGreaterThan(-1);
    expect(hero.indexOf("min-height: calc(100svh - 9rem)")).toBeGreaterThan(
      hero.indexOf("min-height: calc(100vh - 9rem)")
    );
    expect(LANDING).toContain("env(safe-area-inset-top)");
    expect(LANDING).toContain("env(safe-area-inset-bottom)");
    expect(LAYOUT).toMatch(/viewportFit:\s*"cover"/);
  });

  it("draws the lockup as HTML, not a hydration island", () => {
    expect(MARK).not.toMatch(/^["']use client["']/m);
    expect(MARK).not.toMatch(/import \{[^}]*useId/);
    expect(LANDING).toContain('uid="hero"');
    expect(LANDING).toContain('uid="foot"');
  });

  it("names Google on this page, not on every room", () => {
    expect(PAGE).toMatch(
      /rel="preconnect"[^>]*href="https:\/\/accounts\.google\.com"/
    );
    expect(PAGE).toMatch(
      /rel="dns-prefetch"[^>]*href="https:\/\/accounts\.google\.com"/
    );
    expect(LAYOUT).not.toContain("dns-prefetch");
    expect(LAYOUT).not.toContain("accounts.google.com");
  });

  it("keeps the sign-in form a server component", () => {
    expect(SIGNIN).not.toMatch(/^["']use client["']/m);
    expect(SIGNIN).toContain("TrackSubmit");
    expect(SIGNIN).toContain('event="signin_google_started"');
  });

  it("asks the document for three brand files, not a raster of every size", () => {
    expect(LAYOUT).toContain("/favicon.svg?v=3");
    expect(LAYOUT).toContain("/favicon.ico?v=3");
    expect(LAYOUT).toContain("/apple-touch-icon.png?v=3");
    expect(LAYOUT).not.toContain("/icons/icon-16.png");
    expect(LAYOUT).not.toContain("/icons/icon-32.png");
    expect(LAYOUT).not.toContain("/icons/icon-48.png");
    expect(LAYOUT).not.toContain("/icons/icon-192.png");
    expect(LAYOUT).not.toContain("/icons/icon-180.png");
  });

  it("does not register the service worker on the first paint", () => {
    expect(SW).toContain("requestIdleCallback");
  });
});

describe("returning visitors do not re-fetch the brand files", () => {
  /*
    The layout asks for favicon.svg, favicon.ico and apple-touch-icon.png
    (plus the hashed icons under /icons/). Those used to miss the cache
    header that og.png already had, so Chrome spent the first paint
    re-downloading them. Lab caches the same set.
  */
  const CONFIG = readFileSync("next.config.ts", "utf8");

  it("gives every public brand file a lifetime", () => {
    expect(CONFIG).toContain("favicon.svg");
    expect(CONFIG).toContain("favicon.ico");
    expect(CONFIG).toContain("apple-touch-icon.png");
    expect(CONFIG).toContain("og.png");
    expect(CONFIG).toContain("arena-mark.svg");
    expect(CONFIG).toContain("/icons/:path*");
    expect(CONFIG).toContain(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    );
  });
});
