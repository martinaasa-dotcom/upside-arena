import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
  Every screen, checked against WCAG 2.1 AA by a machine.

  The hand-written checks in signed-out.spec.ts cover the things worth naming
  out loud — a skip link, one h1, a labelled email field. This is the other
  half: the whole of what a rules engine can decide on its own, over every
  component in the gallery as well as the public pages, so a contrast that
  drifts or a control that loses its name is caught the week it happens rather
  than by somebody who could not use the app.

  It passes clean today. That is the point of adding it now: what it is for is
  the change that has not been written yet.
*/

/*
  Measured after the entrance animation, not during it.

  Without this the first run flagged a submit button at 1.51:1 — #083338 on
  #075159, which is the aqua primary a third of the way through fading in.
  Nobody sees that state to read it, and a check that reports it is a check
  that gets switched off inside a week. So the page is settled first and what
  is measured is what a person actually looks at.
*/
const SETTLE = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  opacity: 1 !important;
}`;

const PAGES = [
  // Every component that lays out somebody else's data, in one place.
  "/gallery",
  "/",
  "/legal/privacy",
  "/legal/terms",
  "/offline",
  "/auth/no-such-page",
];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function violationsOn(page: import("@playwright/test").Page, path: string) {
  await page.addInitScript(() => {
    // The banner is a dialog over the page and is measured on its own.
    window.localStorage.setItem("arena.consent.measurement", "denied");
  });

  await page.goto(path);
  await page.addStyleTag({ content: SETTLE });
  await page.evaluate(() => document.fonts.ready);

  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations;
}

/** Readable enough to fix from, without opening a report. */
function report(violations: Awaited<ReturnType<typeof violationsOn>>): string {
  return violations
    .map((v) => {
      const where = v.nodes
        .slice(0, 4)
        .map((n) => `      ${n.target.join(" ")}\n        ${n.failureSummary?.split("\n").join(" ")}`)
        .join("\n");
      return `  [${v.impact}] ${v.id} — ${v.help}\n${where}`;
    })
    .join("\n");
}

for (const path of PAGES) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    const violations = await violationsOn(page, path);
    expect(violations, `\n${report(violations)}\n`).toEqual([]);
  });
}

/*
  And the same question the clipping probe has to answer: can this fail?

  A rules engine that silently stopped running would pass every page above
  forever. So this plants something no page should contain and asks to be told
  about it.
*/
test("the sweep reports a violation when there is one", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({ content: SETTLE });

  await page.evaluate(() => {
    // An image with no alt text: one of the least arguable failures there is.
    const img = document.createElement("img");
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    img.width = 40;
    img.height = 40;
    document.body.append(img);
  });

  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    violations.some((v) => v.id === "image-alt"),
    "the sweep sees an image with no alternative text"
  ).toBe(true);
});
