import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

/*
  The dock has to fit on the screen it is drawn on, and every room in it has
  to be findable by somebody who has not been there yet.

  Both of those have been got wrong before, and the second one is why this
  file changed shape. Adding a fifth room pushed the labelled row past the
  width it hid its labels at, and nothing caught it. Then the rule meant to
  save it, hide the labels under 544px, turned out to fire on every phone
  anybody owns, so the fix for a row that did not fit was five unlabelled
  glyphs. The rule written after that was "never hide a dock label", and this
  suite enforced it by refusing the string `sr-only`.

  THAT RULE IS GONE, AND WHAT REPLACED IT IS A STRONGER PROMISE. The dock is
  now a hugging capsule of glyphs on a phone, and it says the name of every
  room you touch at the moment you touch it: `pointerdown` puts the pressed
  cell's name above the bar for most of a second. A ban on `sr-only` was a ban
  on a symptom. What was ever being defended is that a person can find a room
  they have not been to, so that is what is asserted here instead: every cell
  carries an accessible name, the name is spoken on a press and on a focus,
  and the label is painted as well from `md`, where a pointer is holding it.

  The widths are still measured rather than reasoned about. A rule about which
  breakpoint to use has to be re-derived every time a room is added; a
  measurement does not.

  The dock lives behind a sign-in, so its markup is drawn onto a real page
  instead. The stylesheet, the font and the classes are the real ones, which
  is what the width depends on. The rooms and the dock's own class strings are
  read out of the source so this cannot quietly drift away from it.

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

/*
  The dock's own class strings, read out of the component for the same reason
  the rooms are: a probe that hardcodes them would keep passing after somebody
  edits the real thing. The cell's string is the pair inside `cn(...)` on the
  Link, which is where the phone's square cell and the desktop's labelled one
  live.
*/
const NAV_CLASS = SOURCE.match(/<nav[\s\S]*?className="([^"]+)"/)?.[1] ?? "";

const DOCK_CLASS = SOURCE.match(/className="(card-sheen glass glass-dock[^"]+)"/)?.[1] ?? "";

const CELL_CLASS =
  SOURCE.match(/"(relative z-\[1\] flex size-12[^"]+)",\s*\n\s*"(md:w-auto[^"]+)"/)
    ?.slice(1, 3)
    .join(" ") ?? "";

const LABEL_CLASS = SOURCE.match(/className="(hidden leading-none md:inline)"/)?.[1] ?? "";

/*
  One cell, drawn the way the component draws it: a glyph at the size the
  component uses, and the label that only paints from `md`.
*/
const cell = (label: string, first: boolean) => `
  <a class="${CELL_CLASS} ${first ? "text-foreground" : "text-muted-foreground"}">
    <svg class="size-5 shrink-0" viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>
    <span class="probe-label ${LABEL_CLASS}">${label}</span>
  </a>`;

const DOCK = `
<nav id="probe" class="${NAV_CLASS}">
  <div id="probe-well" class="${DOCK_CLASS}">
    ${ROOMS.map((label, i) => cell(label, i === 0)).join("")}
  </div>
</nav>`;

test.describe("the dock", () => {
  test("is read correctly out of the component", () => {
    // If any of these comes back empty the widths below would all pass while
    // measuring nothing at all.
    expect(ROOMS.length).toBeGreaterThan(1);
    expect(NAV_CLASS, "the nav's class string was read").not.toBe("");
    expect(DOCK_CLASS, "the capsule's class string was read").not.toBe("");
    expect(CELL_CLASS, "the cell's class string was read").not.toBe("");
    expect(LABEL_CLASS, "the label's class string was read").not.toBe("");
  });

  /*
    The promise that replaced "never hide a label". Every part of it is here
    because every part of it is load-bearing: an accessible name with no chip
    is a dock only a screen reader can navigate, and a chip on `click` rather
    than `pointerdown` arrives after the tap it was meant to answer.
  */
  test("names every room, and says the name on a press", () => {
    expect(SOURCE, "every cell carries its room's name").toContain(
      "aria-label={label}"
    );
    expect(SOURCE, "the name is spoken as the finger lands").toContain(
      "onPointerDown={(event) => say(label, event.currentTarget)}"
    );
    expect(SOURCE, "and to a keyboard, which never presses anything").toContain(
      "onFocus={(event) => say(label, event.currentTarget)}"
    );
  });

  test("paints the label from md, and draws no chip there", () => {
    expect(LABEL_CLASS, "the label is painted from md").toContain("md:inline");
    expect(SOURCE, "the chip is not drawn where the label already is").toMatch(
      /ring-foreground\/20 md:hidden/
    );
  });

  /*
    Every width a phone or a small tablet actually reports, plus `md` and the
    width either side of it, which is where the cells grow their labels.
  */
  for (const width of [320, 360, 375, 390, 414, 480, 540, 600, 767, 768, 900, 1280]) {
    test(`fits inside ${width}px, labels and all`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await page.evaluate((html) => {
        document.body.insertAdjacentHTML("beforeend", html);
      }, DOCK);

      // A fallback face measures differently from the one that ships.
      await page.evaluate(() => document.fonts.ready);

      const { dock, viewport, overflowing } = await page.evaluate(() => {
        /*
          A label is clipped when it is wider than the padding box of the cell
          holding it, not when it is wider than the viewport. Measuring
          against the viewport is what let a label spill inside a 52px cell on
          a 320px screen while the row itself "fitted" perfectly.

          Below `md` the label is `display: none`, so this asks nothing and
          the width check above is the whole test. That is the correct shape:
          there is no painted word down there to clip.
        */
        const overflowing: string[] = [];
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>(".probe-label")
        )) {
          if (getComputedStyle(el).display === "none") continue;
          const cell = el.parentElement!;
          const style = getComputedStyle(cell);
          const room =
            cell.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight);
          const needed = el.getBoundingClientRect().width;
          if (needed > room + 0.5) {
            overflowing.push(
              `${el.textContent} needs ${needed.toFixed(1)}px in ${room.toFixed(1)}px`
            );
          }
        }
        return {
          dock: document.getElementById("probe-well")!.getBoundingClientRect().width,
          viewport: document.documentElement.clientWidth,
          overflowing,
        };
      });

      expect(
        dock,
        `the dock is ${dock.toFixed(0)}px inside a ${width}px screen`
      ).toBeLessThanOrEqual(viewport);

      expect(
        overflowing,
        `labels spilling their cells at ${width}px:\n  ${overflowing.join("\n  ")}`
      ).toEqual([]);
    });
  }
});

/*
  The dock spans the whole width; only the capsule in the middle of it draws
  anything. A fixed element takes clicks across its entire box whether or not
  it paints, so without `pointer-events-none` on the nav the empty band either
  side of the capsule quietly ate every click along the bottom of the page --
  the "Make your first trade" button in the bottom-right corner of /home did
  nothing at all when you pressed it. The capsule hugs its contents now, so
  that empty band is wider than it has ever been.

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
    expect(DOCK_CLASS, "the capsule's class string was read").not.toBe("");
  });

  test("lets a bottom-corner control be clicked", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    /*
      Answer the measurement question before the page loads. That banner is a
      dialog anchored to the same corner, and it is *supposed* to take the
      clicks under it while it is open -- leaving it up would have this test
      measuring the banner instead of the dock.
    */
    await page.addInitScript(() => {
      window.localStorage.setItem("arena.consent.measurement", "denied");
    });
    await page.goto("/");
    await page.evaluate(
      ([nav, dock, corner, rooms]) => {
        document.body.insertAdjacentHTML("beforeend", corner as string);
        const el = document.createElement("nav");
        /*
          Identified, and selected by that id below. This used to be reached
          with `nav a`, which quietly meant "the first nav on the page": the
          moment the landing grew a footer nav of its own, the probe clicked a
          real link, navigated away, and reported that the dock had not been
          clicked. A fixture has to be addressed as a fixture.
        */
        el.id = "probe-dock";
        el.className = nav as string;
        el.innerHTML =
          `<div class="${dock}">` +
          (rooms as string[])
            .map((r) => `<a class="flex size-12 items-center justify-center">${r}</a>`)
            .join("") +
          `</div>`;
        document.body.append(el);
        (window as unknown as { hits: string[] }).hits = [];
        document.getElementById("corner")!.addEventListener("click", () => {
          (window as unknown as { hits: string[] }).hits.push("corner");
        });
        el.querySelector("a")!.addEventListener("click", () => {
          (window as unknown as { hits: string[] }).hits.push("dock");
        });
      },
      [NAV_CLASS, DOCK_CLASS, CORNER, ROOMS] as const
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
    await page.locator("#probe-dock a").first().click();

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
  the dock's tabs, but the dock is rendered by (app)/layout, so it is on
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
      ([nav, dockCls, notice, rooms, dock]) => {
        if (dock) {
          const el = document.createElement("nav");
          el.className = nav as string;
          el.setAttribute("data-dock", "");
          el.id = "probe-dock";
          el.innerHTML =
            `<div id="probe-pill" class="${dockCls}">` +
            (rooms as string[])
              .map((r) => `<a class="flex size-12 items-center justify-center">${r}</a>`)
              .join("") +
            `</div>`;
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
      [NAV_CLASS, DOCK_CLASS, cls, ROOMS, withDock] as const
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
    relative to the notice, and 768 is `md`, where the cells grow labels and
    so where the dock's edges move.
  */
  for (const width of [320, 390, 767, 768, 1280]) {
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
