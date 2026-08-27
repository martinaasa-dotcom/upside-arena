/**
 * The landing page must never look like it is still loading.
 *
 * The feedback this guards: somebody scrolls down the signed-out page, the
 * next section is not drawn yet, and the reasonable thing to conclude is
 * that the page has ended, so they scroll back up and never see the rest of
 * it. That used to be an IntersectionObserver fade. It is gone. Everything
 * the HTML carries is painted. These checks are against the source, because
 * the settled page looks the same either way, which is the whole problem.
 *
 * Lab dropped the fade when it split the field. Arena had kept `Arrive`
 * with a long lead, which still wrote a translated layer on anything below
 * that lead and still hydrated five observers. Older WebKit skips a
 * translated layer until it scrolls on-screen, which is the sample card
 * popping in. The two apps are one design, so the two guards say the same
 * thing on purpose.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LANDING = readFileSync("src/components/SignedOutLanding.tsx", "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");

/** Every `<SectionHead …/>` plus the markup until the next function. */
function sectionAfterHead(source: string, title: string): string {
  const head = source.indexOf(`title="${title}"`);
  expect(head, `SectionHead "${title}" is missing`).toBeGreaterThan(-1);
  const from = source.lastIndexOf("<SectionHead", head);
  const next = source.slice(from + 1).search(/\n(?:export )?function /);
  return source.slice(from, next === -1 ? undefined : from + 1 + next);
}

describe("the landing page is drawn, not revealed", () => {
  it("never writes a hide attribute, and never observes the fold", () => {
    expect(LANDING).not.toContain("data-reveal");
    expect(LANDING).not.toContain("IntersectionObserver");
    expect(LANDING).not.toContain("ARRIVE_LEAD");
    expect(LANDING).not.toContain("<Arrive");
    expect(CSS).not.toContain("[data-reveal]");
  });

  it("keeps a heading and the cards it heads in one section", () => {
    const headed = [
      [
        "The same money on Monday. A scoreboard on Friday. An argument all week.",
        /<(div|WeekStill|BattleStill)/,
      ],
      [
        "It starts with the people you already argue with.",
        /<(ol|div)/,
      ],
      ["The week is only the start of it.", /<(div)/],
    ] as const;

    for (const [title, cards] of headed) {
      const block = sectionAfterHead(LANDING, title);
      expect(
        block,
        "a SectionHead that arrives without the row it is the heading of"
      ).toMatch(cards);
    }
  });

  it("staggers nothing, so no part of a section can lag another", () => {
    expect(LANDING).not.toContain("delayMs");
    expect(LANDING).not.toContain("transitionDelay");
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
