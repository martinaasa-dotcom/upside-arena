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

/*
  The dock's own two class strings, read out of the component for the same
  reason the rooms are: a probe that hardcodes them would keep passing after
  someone edits the real thing.
*/
const NAV_CLASS = SOURCE.match(/<nav[\s\S]*?className="([^"]+)"/)?.[1] ?? "";
const PILL_CLASS =
  SOURCE.match(/<nav[\s\S]*?<div className="([^"]+)"/)?.[1] ?? "";

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

/*
  The dock spans the whole width; only the pill in the middle of it draws
  anything. A fixed element takes clicks across its entire box whether or not
  it paints, so without `pointer-events-none` on the nav the empty band either
  side of the pill quietly ate every click along the bottom of the page — the
  "Make your first trade" button in the bottom-right corner of /home did
  nothing at all when you pressed it.

  Hit-testing is the only way to see this. The dock renders perfectly, the
  button renders perfectly, and a render test of either one passes while the
  page is broken. So this asks the browser the two questions a person asks
  with a mouse: what is under this pixel, and does pressing it do anything.
*/
test.describe("the dock and the corner beside it", () => {
  const CORNER = `
<button id="corner" style="position:fixed;right:24px;bottom:28px;z-index:10;padding:10px 16px;">
  Make your first trade
</button>`;

  test("carries the classes that make it click-through", () => {
    // Without these the probe below would be measuring nothing.
    expect(NAV_CLASS, "the nav's class string was read").not.toBe("");
    expect(PILL_CLASS, "the pill's class string was read").not.toBe("");
  });

  test("lets a bottom-corner control be clicked", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    /*
      Answer the measurement question before the page loads. That banner is a
      dialog anchored to the same corner, and it is *supposed* to take the
      clicks under it while it is open — leaving it up would have this test
      measuring the banner instead of the dock.
    */
    await page.addInitScript(() => {
      window.localStorage.setItem("arena.consent.measurement", "denied");
    });
    await page.goto("/");
    await page.evaluate(
      ([nav, pill, corner, rooms]) => {
        document.body.insertAdjacentHTML("beforeend", corner as string);
        const el = document.createElement("nav");
        el.className = nav as string;
        el.innerHTML = `<div class="${pill}">${(rooms as string[])
          .map((r) => `<a class="flex h-11 items-center px-4">${r}</a>`)
          .join("")}</div>`;
        document.body.append(el);
        (window as unknown as { hits: string[] }).hits = [];
        document.getElementById("corner")!.addEventListener("click", () => {
          (window as unknown as { hits: string[] }).hits.push("corner");
        });
        el.querySelector("a")!.addEventListener("click", () => {
          (window as unknown as { hits: string[] }).hits.push("dock");
        });
      },
      [NAV_CLASS, PILL_CLASS, CORNER, ROOMS] as const
    );

    const under = await page.evaluate(() => {
      const r = document.getElementById("corner")!.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el?.id || el?.tagName.toLowerCase() || "none";
    });
    expect(under, "the corner button is what sits under its own pixels").toBe(
      "corner"
    );

    await page.locator("#corner").click();
    await page.locator("nav a").first().click();

    // The dock must still take the clicks that land on it.
    const hits = await page.evaluate(
      () => (window as unknown as { hits: string[] }).hits
    );
    expect(hits).toEqual(["corner", "dock"]);
  });
});
