/*
  The signed-out page has to say, at the fold, that it continues.

  On a phone it stacks, and the sample league lands under the fold with the
  sign-in card above it looking like the end of the page. Nothing said
  otherwise. `ScrollCue` is pinned to the bottom of the window, fades the
  content under it into the field, and draws nothing at all on a window the
  whole page already fits inside.

  Asserted against the source: this is a handful of numbers typed into class
  names, and the failure is a layout nobody looks at on the one screen size
  where it matters.
*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CUE = readFileSync("src/components/ScrollCue.tsx", "utf8");
const LANDING = readFileSync("src/components/SignedOutLanding.tsx", "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");

describe("the scroll cue", () => {
  it("is mounted on the signed-out page", () => {
    expect(LANDING).toContain("<ScrollCue />");
  });

  it("leaves the next section standing clear of its own fade", () => {
    // A peek shorter than the fade would be faded out by the very thing
    // meant to be pointing at it.
    const fade = CUE.match(/\bh-(\d+)\b[^"]*bg-gradient-to-t/);
    expect(fade, "the fade carries a height").not.toBeNull();
    const peek = LANDING.match(/min-h-\[calc\(100svh-(\d+(?:\.\d+)?)rem\)\]/);
    expect(peek, "the hero carries a height floor").not.toBeNull();
    expect(Number(peek![1])).toBeGreaterThan(Number(fade![1]) / 4);
  });

  it("uses `svh`, so a retracting address bar cannot outgrow the hero", () => {
    expect(LANDING).toContain("100svh");
    expect(LANDING).not.toContain("100dvh");
  });

  it("is pinned to the window, not laid out under the last card", () => {
    expect(CUE).toContain("fixed");
  });

  it("takes its height off the bottom from .bottom-notice", () => {
    // Same rule the measurement question takes, so a page with a dock lifts
    // it rather than having a number guessed at the call site.
    expect(CUE).toContain("bottom-notice");
    expect(CUE, "a bottom-* utility on the cue itself").not.toMatch(
      /"[^"]*\bbottom-\[/
    );
  });

  it("stops drawing once the reader has scrolled or has nowhere to go", () => {
    expect(CUE).toContain("scrollTop");
    expect(CUE).toContain("scrollHeight");
  });

  it("never swallows clicks along the bottom of the page", () => {
    // Full width and transparent over content. Without this it eats every
    // click on the bottom strip of the page.
    const fade = CUE.slice(CUE.indexOf("bg-gradient-to-t") - 400);
    expect(fade).toContain("pointer-events-none");
  });

  it("stands down while the measurement question holds the same line", () => {
    // Below `sm` that question is a full-width strip on this exact line.
    expect(CUE).toContain("max-sm:hidden");
  });

  it("has its nudge defined, so reduced motion can switch it off", () => {
    expect(CUE).toContain("scroll-cue-nudge");
    expect(CSS).toMatch(/\.scroll-cue-nudge\s*\{/);
    expect(CSS).toMatch(/@keyframes scroll-cue-nudge/);
  });
});
