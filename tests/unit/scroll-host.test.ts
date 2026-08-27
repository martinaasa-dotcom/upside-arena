/**
 * Scrollbars sit in a reserved track, never on a field.
 *
 * Overlay bars (macOS, iOS) ignore `scrollbar-gutter` and paint on the
 * content. The walkthrough scroller had no inline-end inset, so a full-width
 * row ran under the bar. The onboarding fields sat on a page with the same
 * overlay and no gutter on the root.
 *
 * `.scroll-host` is the only custom track. Firefox 153 answers true for
 * `@supports selector(::-webkit-scrollbar)` without implementing thumb
 * styling, so padding must not be gated on that query. Clearance is 1rem
 * in `@layer base` so a `p-6` on the same node still wins. Nested overflow
 * wells are not hosts. The page scroller is not a host. Asserted against
 * the source because the failure is a class and a cascade layer, not a
 * number a render would show.
 *
 * Upside Lab has the same guard. Fix both or neither.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/app/scroll-host.css", "utf8");
const GLOBALS = readFileSync("src/app/globals.css", "utf8");

function stripComments(block: string): string {
  return block.replace(/\/\*[\s\S]*?\*\//g, "");
}

function ruleNamed(css: string, name: string): string {
  const stripped = stripComments(css);
  const match = stripped.match(
    new RegExp(`(?:^|\\n)\\s*${name}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`)
  );
  if (!match) throw new Error(`no ${name} rule`);
  return match[1];
}

/** Layout rules for `.scroll-host` inside `@layer base`. */
function hostLayout(): string {
  const padAt = CSS.indexOf("padding-inline-end: var(--scroll-clearance)");
  if (padAt < 0) throw new Error("layered .scroll-host padding is missing");
  const layerAt = CSS.lastIndexOf("@layer base", padAt);
  if (layerAt < 0) {
    throw new Error(
      "the 1rem inset has to stay in @layer base so a padding utility on the same node still wins"
    );
  }
  const from = CSS.slice(layerAt);
  const match = from.match(/\.scroll-host\s*\{([\s\S]*?)\n\s*\}/);
  if (!match) throw new Error("no layered .scroll-host rule");
  return stripComments(match[1]);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe("scroll hosts keep the bar off the fields", () => {
  it("is imported from the global stylesheet", () => {
    expect(GLOBALS).toMatch(/@import "\.\/scroll-host\.css"/);
  });

  it("aliases no-scrollbar next to the rail hide, so a future rail stays bar-free", () => {
    expect(CSS).toMatch(/\.scrollbar-none,\s*\n\s*\.no-scrollbar\s*\{/);
  });

  it("reserves a gutter on every vertical scroller", () => {
    expect(CSS).toMatch(
      /\[class\*="overflow-y-auto"\]:not\(\.scrollbar-none\):not\(\.no-scrollbar\)[\s\S]*?scrollbar-gutter:\s*stable/
    );
  });

  it("styles only .scroll-host, with one track size and one thumb", () => {
    expect(CSS).toMatch(/--scroll-track:\s*0\.5rem/);
    expect(CSS).toMatch(/--scroll-clearance:\s*1rem/);
    expect(CSS).toMatch(/\.scroll-host::-webkit-scrollbar\s*\{/);
    expect(CSS).toMatch(/width:\s*var\(--scroll-track/);
    expect(CSS).toMatch(/scrollbar-color:\s*var\(--scroll-thumb\)\s+transparent/);
    expect(CSS).toMatch(/--scroll-thumb-hover:/);
    expect(CSS).not.toMatch(
      /\[role="dialog"\][\s\S]{0,120}\[class\*="overflow-y-auto"\]/
    );
  });

  it("does not gate padding on the Firefox 153 webkit-scrollbar lie", () => {
    expect(stripComments(CSS)).not.toMatch(
      /@supports\s+selector\(::-webkit-scrollbar\)\s*\{/
    );
    expect(stripComments(GLOBALS)).not.toMatch(
      /@supports\s+selector\(::-webkit-scrollbar\)\s*\{/
    );
  });

  it("keeps 1rem from field to track, in @layer base", () => {
    const layout = hostLayout();
    expect(layout).toMatch(/padding-inline-end:\s*var\(--scroll-clearance\)/);
    expect(layout).toMatch(/touch-action:\s*pan-y/);
    expect(layout).toMatch(/scrollbar-gutter:\s*stable/);
    expect(layout).toMatch(/overflow-y:\s*auto/);
  });

  it("does not clamp every input in the app to 100%", () => {
    expect(CSS).toMatch(
      /\.scroll-host :is\(input, textarea, select\)[\s\S]*?max-width:\s*100%/
    );
    expect(ruleNamed(GLOBALS, ":is\\(input, textarea, select\\)")).not.toMatch(
      /max-width/
    );
  });

  it("keeps field scroll-margin on the document", () => {
    expect(ruleNamed(GLOBALS, ":is\\(input, textarea, select\\)")).toMatch(
      /scroll-margin-block:\s*1\.5rem/
    );
  });

  it("does not put overflow back on html, and still reserves the page gutter", () => {
    expect(
      ruleNamed(GLOBALS, "html"),
      "an overflow on the root makes it a scroll container, and every popper anchored to the sticky or fixed chrome is then drawn one scroll offset above where it belongs"
    ).not.toMatch(/(^|\s)overflow(-x|-y)?\s*:/);
    expect(ruleNamed(GLOBALS, "html")).toMatch(/scrollbar-gutter:\s*stable/);
  });

  it("parks the walkthrough track in the dialog pad on the end only", () => {
    const tour = readFileSync("src/components/WelcomeTour.tsx", "utf8");
    expect(tour).toMatch(/scroll-host -me-4 pe-4 sm:-me-6 sm:pe-6/);
    expect(tour).not.toMatch(/scroll-host -mx-/);
  });

  it("never adds a raw overflow-y-auto without .scroll-host", () => {
    const files = walk("src").filter(
      (path) => path.endsWith(".tsx") || path.endsWith(".ts")
    );
    for (const path of files) {
      const src = readFileSync(path, "utf8");
      if (!src.includes("overflow-y-auto") && !src.includes("overflow-y-scroll")) {
        continue;
      }
      expect(src, `${path} scrolls vertically without .scroll-host`).toContain(
        "scroll-host"
      );
    }
  });
});
