import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

/*
  The dock has to fit on the screen it is drawn on.

  This is measured rather than reasoned about, because it has already been got
  wrong once: adding a fifth room pushed the labelled row past the width it
  hid its labels at, and nothing caught it, because a dock that overflows
  still renders perfectly well. A rule about which breakpoint to use would
  have to be re-derived every time a room is added; a measurement does not.

  The dock lives behind a sign-in, so its markup is drawn onto a real page
  instead. The stylesheet, the font and the classes are the real ones, which
  is what the width depends on. The rooms and the label rule are read out of
  the component itself so this cannot quietly drift away from it.
*/

const SOURCE = readFileSync("src/components/BottomDock.tsx", "utf8");

const ROOMS = [...SOURCE.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

const LABELS_FIT = SOURCE.match(/const LABELS_FIT = "([^"]+)"/)?.[1] ?? "";

const DOCK = `
<nav id="probe" style="position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;">
  <div id="probe-well" class="card-sheen glass flex items-center gap-1 rounded-xl p-1 ring-1 ring-foreground/20">
    ${ROOMS.map(
      (label, i) => `
      <a class="flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium ${
        i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
      }">
        <svg class="size-4" viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>
        <span class="${LABELS_FIT}">${label}</span>
      </a>`
    ).join("")}
  </div>
</nav>`;

test.describe("the dock", () => {
  test("is read correctly out of the component", () => {
    // If either of these comes back empty the widths below would all pass
    // while measuring nothing at all.
    expect(ROOMS.length).toBeGreaterThan(1);
    expect(LABELS_FIT).toMatch(/^max-\[\d+px\]:sr-only$/);
  });

  /*
    Every width a phone or a small tablet actually reports, plus the two on
    either side of the label rule, which is where it broke last time.
  */
  for (const width of [320, 360, 375, 390, 414, 480, 500, 540, 543, 544, 600, 768]) {
    test(`fits inside ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await page.evaluate((html) => {
        document.body.insertAdjacentHTML("beforeend", html);
      }, DOCK);

      // A fallback face measures differently from the one that ships.
      await page.evaluate(() => document.fonts.ready);

      const { dock, viewport } = await page.evaluate(() => ({
        dock: document.getElementById("probe-well")!.getBoundingClientRect().width,
        viewport: document.documentElement.clientWidth,
      }));

      expect(
        dock,
        `the dock is ${dock.toFixed(0)}px inside a ${width}px screen`
      ).toBeLessThanOrEqual(viewport);
    });
  }
});
