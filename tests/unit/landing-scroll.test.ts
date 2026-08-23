/**
 * The landing page must never look like it is still loading.
 *
 * The feedback this guards: somebody scrolls the signed-out page, the next
 * section is not drawn yet, and the reasonable thing to conclude is that
 * the page has ended, so they scroll back up and never see the rest of it.
 * Two causes, both numbers typed into a component rather than anything a
 * render would show, which is why this reads the source.
 *
 * One, `Arrive` armed its observer with `rootMargin: "0px 0px -12% 0px"`, a
 * negative margin, which shrinks the observer's root instead of growing it.
 * Measured against the real page at 390x844 and 1440x900, every block on it
 * flipped to "in" while sitting 116px to 185px inside the window, and only
 * then started a half-second fade. Two, a section's heading and its row of
 * cards were two separate `Arrive` blocks with the cards on a delay, so the
 * commonest thing a reader saw at a boundary was a title with a hole under
 * it.
 *
 * Both arrived here with the page itself, which was ported from Upside
 * Lab. Lab's copy is fixed the same way and holds itself to the same rules
 * in `src/lib/landing-scroll.test.ts`. The two apps are one design, so the
 * two guards say the same thing on purpose.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ARRIVE = readFileSync("src/components/Arrive.tsx", "utf8");
const LANDING = readFileSync("src/components/SignedOutLanding.tsx", "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");

/** Every `<Arrive …>…</Arrive>` block on the landing, body text included. */
function arriveBlocks(source: string): string[] {
  const out: string[] = [];
  const open = /<Arrive(\s[^>]*)?>/g;
  let match: RegExpExecArray | null;
  while ((match = open.exec(source))) {
    const end = source.indexOf("</Arrive>", match.index);
    if (end === -1) continue;
    out.push(source.slice(match.index, end));
  }
  return out;
}

describe("the landing page arrives ahead of the fold", () => {
  it("grows the observer's root rather than shrinking it", () => {
    const lead = ARRIVE.match(/const ARRIVE_LEAD = ([\d.]+);/);
    expect(lead, "ARRIVE_LEAD is gone").not.toBeNull();

    // A whole screen at least. Below 1 a section can arrive while somebody
    // is looking at the space it will occupy, which is the bug.
    expect(Number(lead![1])).toBeGreaterThanOrEqual(1);

    expect(ARRIVE).toMatch(
      /rootMargin: `0px 0px \$\{Math\.round\(ARRIVE_LEAD \* 100\)\}% 0px`/
    );
    expect(ARRIVE, "a negative rootMargin is the old bug").not.toMatch(
      /rootMargin:[^,\n]*-\d/
    );
  });

  it("draws what is already within the lead instead of fading it", () => {
    // The screenful under the hero is finished before the first scroll
    // rather than starting to arrive because of one. It is also what stops
    // a section flashing empty on mount, and what makes a reload halfway
    // down the page draw its surroundings rather than animate them.
    expect(ARRIVE).toContain("window.innerHeight * (1 + ARRIVE_LEAD)");
  });

  it("staggers nothing, so no part of a section can lag another", () => {
    expect(ARRIVE).not.toContain("delayMs");
    expect(ARRIVE).not.toContain("transitionDelay");
    expect(LANDING).not.toContain("delayMs");
  });

  it("keeps a heading and the cards it heads in one block", () => {
    const blocks = arriveBlocks(LANDING);
    expect(blocks.length).toBeGreaterThan(0);

    for (const block of blocks) {
      if (!block.includes("<SectionHead")) continue;
      expect(
        block,
        "a SectionHead that arrives without the row it is the heading of"
      ).toMatch(/<(div|ol) className="mt-\d+ grid/);
    }
  });

  it("keeps a ceiling on the fade, so it can never become a wait", () => {
    /*
      Deliberately not tightened. 0.55s was chosen with a reason written
      beside it and the same easing curve as `.rise`, and with the lead
      above it nobody watches it happen anyway. What this stops is somebody
      later deciding an arrival should take a second and a half, which is
      long enough that a reader who outruns the page catches a section
      half-drawn and reads it as still loading.
    */
    const rule = CSS.match(/\[data-reveal\] \{\s*transition:\s*opacity ([\d.]+)s/);
    expect(rule, "the [data-reveal] transition is gone").not.toBeNull();
    expect(Number(rule![1])).toBeLessThanOrEqual(0.6);
  });
});

describe("the landing page leaves no void a reader can mistake for the end", () => {
  it("keeps the gap between two sections under a tenth of a screen", () => {
    /*
      Each section pads itself, so what a reader sees between two of them is
      twice this: 80px on a phone and 96px on a desktop. It was 112/160, and
      160px was the tallest empty band on the page, a fifth of a 900px
      window.
    */
    const pad = LANDING.match(/<section className=\{cn\("px-6 py-(\d+) sm:py-(\d+)"/);
    expect(pad, "the Section padding is written differently now").not.toBeNull();
    expect(Number(pad![1])).toBeLessThanOrEqual(10);
    expect(Number(pad![2])).toBeLessThanOrEqual(12);
  });

  it("sets a heading close enough to its cards to read as one thing", () => {
    for (const gap of LANDING.matchAll(/className="mt-(\d+) grid gap-/g)) {
      expect(Number(gap[1])).toBeLessThanOrEqual(8);
    }
  });
});
