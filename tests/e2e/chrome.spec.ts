import { test, expect } from "@playwright/test";

/*
  The bar at the top and the dock at the bottom, measured as the app renders
  them rather than as a probe rebuilds them.

  Everything carrying this chrome is behind a sign-in and this suite is
  entirely signed out, so until /gallery drew the real components nothing
  here had ever touched them. dock.spec.ts works around that by reading the
  dock's classes out of its own source and drawing a copy; useful, and not
  the same as asking the browser about the thing that ships.

  What this asks is the question a person asks by scrolling: does the bar
  stay where it says it stays. It was reported as not doing -- a gap opening
  between the bar and the top of the window -- and three separate causes were
  fixed on the strength of reading the CSS, none of them reproduced. This is
  the check that would have caught it, and the one that catches it coming
  back.
*/

const WIDTHS = [320, 390, 768, 1280];

/*
  Every Panel draws a <header> for its own title, so the page has two dozen of
  them. The bar is the one that is glass and stuck to the top.
*/
const BAR = "header.glass-bar";

test.describe("the app chrome", () => {
  test("draws the real header and dock", async ({ page }) => {
    await page.goto("/gallery");

    // Both empty would make every assertion below pass against nothing.
    await expect(page.locator(BAR)).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Rooms"]')).toHaveCount(1);
    await expect(page.locator("[data-dock]")).toHaveCount(1);
  });

  for (const width of WIDTHS) {
    test(`keeps the header against the top while scrolling at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto("/gallery");
      await page.evaluate(() => document.fonts.ready);

      const height = await page.evaluate(
        () => document.documentElement.scrollHeight
      );

      /*
        Not just the extremes. A sticky element that detaches does it while
        the scroll is moving, so this walks down the page and back up, and
        asks after every step. Back up as well because the report was about
        scrolling up, and because overscroll-behavior is what stops the
        document being dragged clear of the top.
      */
      const stops = [0, 1, 40, 200, 800, Math.max(1200, height - 1400), height, 800, 200, 40, 1, 0];

      for (const y of stops) {
        await page.evaluate((to) => window.scrollTo(0, to), y);
        await page.waitForTimeout(30);

        const seen = await page.evaluate((sel) => {
          const bar = document
            .querySelector(sel)!
            .getBoundingClientRect();
          const dock = document
            .querySelector('nav[aria-label="Rooms"]')!
            .getBoundingClientRect();
          return {
            barTop: Math.round(bar.top),
            barBottom: Math.round(bar.bottom),
            dockBottom: Math.round(dock.bottom),
            viewport: window.innerHeight,
            scrollY: Math.round(window.scrollY),
          };
        }, BAR);

        expect(
          seen.barTop,
          `the header left a ${seen.barTop}px gap above it at scrollY ${seen.scrollY}`
        ).toBe(0);

        expect(
          seen.barBottom,
          `the header collapsed at scrollY ${seen.scrollY}`
        ).toBeGreaterThan(0);

        expect(
          seen.dockBottom,
          `the dock drifted off the bottom at scrollY ${seen.scrollY}`
        ).toBeLessThanOrEqual(seen.viewport + 1);
      }
    });
  }

  test("keeps the top of the content clear of the bar", async ({ page }) => {
    /*
      The skip link, a hash and the scroll Next performs on a client
      navigation all use the browser's own scrolling, which does not know
      about a sticky bar. scroll-padding-top is what stops them landing
      behind it.
    */
    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto("/gallery");

    const padding = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollPaddingTop
    );
    expect(padding, "html carries a scroll padding").not.toBe("auto");

    const barHeight = await page.evaluate(
      (sel) => document.querySelector(sel)!.getBoundingClientRect().height,
      BAR
    );
    expect(
      parseFloat(padding),
      "the scroll padding covers the bar"
    ).toBeGreaterThanOrEqual(barHeight - 1);
  });

  test("will not let the document be dragged clear of the top", async ({ page }) => {
    await page.goto("/gallery");
    const behaviour = await page.evaluate(
      () => getComputedStyle(document.documentElement).overscrollBehaviorY
    );
    expect(behaviour).toBe("none");
  });
});
