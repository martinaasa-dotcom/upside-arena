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
  the source itself so this cannot quietly drift away from it.

  The rooms come from lib/rooms rather than from the dock, because that is
  where they went when the consent notice needed to know which routes have a
  dock under them. Read from the dock they came back empty, and an empty list
  measures an empty row, which fits inside every screen there is: the width
  probe passed while measuring nothing at all. That is what the first test
  below is for.
*/

const SOURCE = readFileSync("src/components/BottomDock.tsx", "utf8");

const ROOM_SOURCE = readFileSync("src/lib/rooms.ts", "utf8");

const ROOMS = [...ROOM_SOURCE.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

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

/*
  The measurement notice must not cover the dock.

  It used to, on exactly two rooms. The notice chose its height off a list of
  the dock's five tabs, but the dock is rendered by (app)/layout, so it is on
  every room in the group -- Arena Plus and Numbers included, and neither has
  a tab. On those two the notice was told there was no dock, sat at the bottom
  edge, and at z-50 over the dock's z-40 covered the navigation. Measured at
  390px before the fix: the notice spanned the dock exactly.

  A list was the wrong shape for the question. The notice now asks whether a
  [data-dock] element is on the page, so this probe drives the real signal:
  it draws the dock with the dock's own attribute and class, the notice with
  the notice's own class, and asks the browser whether the two boxes touch.
  Both are read out of the components, so editing either one is visible here.
*/
const DOCK_ATTR = /data-dock\b/.test(SOURCE);

const NOTICE_SOURCE = readFileSync("src/components/ConsentBanner.tsx", "utf8");

const NOTICE_CLASS =
  NOTICE_SOURCE.match(/className="(bottom-notice[^"]+)"/)?.[1] ?? "";

/*
  The install prompt is the other pane that lives at the bottom of the window.
  It used to hardcode the lifted position, which was right only because it
  renders solely inside (app), where there is always a dock. It shares the
  class now, so it is measured here too.
*/
const INSTALL_SOURCE = readFileSync("src/components/InstallPrompt.tsx", "utf8");

const INSTALL_CLASS =
  INSTALL_SOURCE.match(/className="(bottom-notice[^"]+)"/)?.[1] ?? "";

test.describe("the measurement notice and the dock", () => {
  test("is read correctly out of the components", () => {
    // Both empty would make every assertion below pass against nothing.
    expect(DOCK_ATTR, "the dock declares itself with data-dock").toBe(true);
    expect(NOTICE_CLASS, "the notice's class string was read").not.toBe("");
    expect(INSTALL_CLASS, "the install prompt's class string was read").not.toBe("");
  });

  /*
    Both panes are role="dialog", the same width, and now the same distance up.
    Shown together they landed on each other, and the notice -- later in the
    document at the same z-index -- painted over the install button and the
    dismiss cross. Neither is dismissible when it is underneath the other, so
    the rule is that only one is ever asked at a time and the measurement
    question goes first.
  */
  test("the install prompt waits for the measurement question", () => {
    expect(
      INSTALL_SOURCE,
      "the install prompt reads the consent choice"
    ).toContain("subscribeToConsent");
    expect(
      INSTALL_SOURCE,
      "and holds while the question is still unanswered"
    ).toMatch(/if \(!visible \|\| asking\) return null;/);
  });

  const draw = async (
    page: import("@playwright/test").Page,
    withDock: boolean,
    cls: string = NOTICE_CLASS
  ) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("arena.consent.measurement");
    });
    await page.goto("/");
    await page.evaluate(
      ([nav, pill, notice, rooms, dock]) => {
        if (dock) {
          const el = document.createElement("nav");
          el.className = nav as string;
          el.setAttribute("data-dock", "");
          el.id = "probe-dock";
          el.innerHTML = `<div id="probe-pill" class="${pill}">${(rooms as string[])
            .map((r) => `<a class="flex h-11 items-center px-4">${r}</a>`)
            .join("")}</div>`;
          document.body.append(el);
        }
        const n = document.createElement("div");
        n.id = "probe-notice";
        n.className = notice as string;
        n.innerHTML =
          `<p class="text-sm">Measuring page views and load times is optional.</p>` +
          `<div class="mt-3 flex gap-2"><button class="h-8 px-3">Allow</button>` +
          `<button class="h-8 px-3">No thanks</button></div>`;
        document.body.append(n);
      },
      [NAV_CLASS, PILL_CLASS, cls, ROOMS, withDock] as const
    );
    await page.evaluate(() => document.fonts.ready);
  };

  const boxes = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const pill = document.getElementById("probe-pill")?.getBoundingClientRect();
      const note = document.getElementById("probe-notice")!.getBoundingClientRect();
      return {
        overlaps: pill
          ? !(
              note.right <= pill.left ||
              note.left >= pill.right ||
              note.bottom <= pill.top ||
              note.top >= pill.bottom
            )
          : false,
        noticeBottom: Math.round(window.innerHeight - note.bottom),
      };
    });

  /*
    390px is the width it broke at. 1280 is where the dock is at its widest
    relative to the notice, and 544 is the label breakpoint, which changes how
    wide the dock is and so where its edges fall.
  */
  for (const width of [320, 390, 544, 768, 1280]) {
    for (const [what, cls] of [
      ["notice", NOTICE_CLASS],
      ["install prompt", INSTALL_CLASS],
    ] as const) {
      test(`keeps the ${what} clear of the dock at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await draw(page, true, cls);

        const { overlaps } = await boxes(page);
        expect(overlaps, `the ${what} covers the dock at ${width}px`).toBe(false);
      });
    }
  }

  test("stays at the bottom edge where there is no dock", async ({ page }) => {
    // The signed-out pages have no dock, and lifting the notice there would
    // leave it floating in the middle of nothing.
    await page.setViewportSize({ width: 390, height: 800 });
    await draw(page, false);

    const { noticeBottom } = await boxes(page);
    expect(noticeBottom, "the notice sits near the bottom edge").toBeLessThan(40);
  });
});
