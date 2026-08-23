import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

/*
  Nothing on a screen may be smaller than what is inside it.

  Four faults shipped in a row that were all this one fault wearing different
  clothes: a fixed-height table row that cropped the second line of a wrapped
  name, a percentage that wrapped into the row below it, and two descriptions
  truncated down to nothing on a narrow phone. Every one of them rendered
  without an error and passed every unit test, because a box with its contents
  hanging out of it is still a valid box. They were caught by a person holding
  a phone, four times, which is not a process.

  A browser already knows the answer. An element whose scrollHeight exceeds
  its clientHeight is one that has more inside it than it is showing, and if
  its overflow is hidden then the difference is not scrolled to — it is gone.
  That is the question, and it is asked of everything.

  Height only, deliberately. Cutting a line of text off mid-word is never
  something anybody chose; cutting a too-long name off with an ellipsis, on
  one line, in a narrow cell, often is — and it is visible when it happens,
  which is the difference. Flagging horizontal overflow would flag every
  `truncate` in the app and the check would be turned off within a week.
*/

/** Every width a phone or small tablet reports, plus a desktop for contrast. */
const WIDTHS = [320, 360, 375, 390, 414, 480, 540, 768, 1280];

type Clip = { where: string; hidden: number; text: string };

/*
  Run inside the page. Returns every element hiding part of its own contents,
  described well enough to find in the source without a screenshot.
*/
async function clipped(page: import("@playwright/test").Page): Promise<Clip[]> {
  await page.evaluate(() => document.fonts.ready);

  return page.evaluate(() => {
    const out: { where: string; hidden: number; text: string }[] = [];

    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const style = getComputedStyle(el);

      // Nothing is hidden by a box that is not being drawn.
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (Number(style.opacity) === 0) continue;

      /*
        Only boxes that clip. `visible` and `auto`/`scroll` both let a reader
        reach the rest, one by spilling and one by scrolling.
      */
      const overflowY = style.overflowY;
      if (overflowY !== "hidden" && overflowY !== "clip") continue;

      // A deliberate ellipsis on a single line is a choice, not a fault.
      if (style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap") continue;

      /*
        And neither is a box that has been clipped away on purpose. `sr-only`
        crushes an element to a pixel behind `clip-path: inset(50%)` so a
        screen reader can still read it — the skip link and every hidden form
        label. They cut off all of their own contents by design, and nothing
        else in the app sets a clip path, so this is the marker to read.
      */
      if (style.clipPath !== "none") continue;

      const hidden = el.scrollHeight - el.clientHeight;
      /*
        A pixel or two is subpixel rounding on a fractional line height, not a
        cropped line. Half the smallest text in the app is the smallest amount
        that can actually take a piece of a character off.
      */
      if (hidden <= 6) continue;

      // Where it is, in terms somebody can search the source for.
      const path: string[] = [];
      for (let node: HTMLElement | null = el; node && node !== document.body; ) {
        const cls = node.className;
        path.unshift(
          node.tagName.toLowerCase() +
            (typeof cls === "string" && cls ? `.${cls.trim().split(/\s+/).join(".")}` : "")
        );
        node = node.parentElement;
      }

      out.push({
        where: path.slice(-2).join(" > "),
        hidden: Math.round(hidden),
        text: (el.textContent ?? "").trim().slice(0, 60),
      });
    }

    return out;
  });
}

function report(clips: Clip[]): string {
  return clips
    .map((c) => `  ${c.hidden}px of "${c.text}" is cut off by ${c.where}`)
    .join("\n");
}

/*
  The gallery holds every component that lays out somebody else's data, given
  the widest values it will ever be handed. The signed-out pages are here too,
  because they are the only screens a visitor sees before deciding whether to
  play at all.
*/
const PAGES: { path: string; status?: number }[] = [
  { path: "/gallery" },
  { path: "/" },
  { path: "/legal/privacy" },
  { path: "/legal/terms" },
  { path: "/offline" },
  /*
    The address with nothing behind it, reached the way a person reaches it
    rather than by rendering the component.

    Under /auth/ because that is one of the few prefixes the proxy treats as
    public: everywhere else an unknown path is redirected to sign-in and never
    reaches a 404 at all, which is what this assertion originally measured
    without noticing.
  */
  { path: "/auth/no-such-page", status: 404 },
];

for (const { path, status = 200 } of PAGES) {
  test.describe(path, () => {
    for (const width of WIDTHS) {
      test(`shows all of itself at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });

        // The banner is a dialog over the page; it is measured on its own.
        await page.addInitScript(() => {
          window.localStorage.setItem("arena.consent.measurement", "denied");
        });

        const response = await page.goto(path);
        expect(response?.status(), `${path} answers as expected`).toBe(status);

        const clips = await clipped(page);
        expect(clips, `\n${report(clips)}\n`).toEqual([]);
      });
    }
  });
}

/*
  The probe has to be able to fail.

  Every skip in it is a rule about what does not count — an ellipsis, a
  visually-hidden label, a few pixels of rounding — and each one is a chance
  to widen it until nothing counts at all. So this plants the exact fault the
  probe exists to catch, in the shape it shipped in, and asks to be told about
  it. If a future skip swallows this, the check above has stopped measuring
  anything and every page passes forever.
*/
test("reports a row that crops its own second line", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/gallery");

  await page.evaluate(() => {
    const row = document.createElement("div");
    // A fixed height with two lines inside it. This is the fault, exactly.
    row.style.cssText = "height:56px;overflow:hidden;width:200px;font-size:14px";
    row.textContent =
      "A name long enough to wrap onto a second line, and then a subtitle under it";
    document.body.append(row);
  });

  const found = await clipped(page);
  expect(
    found.some((c) => c.text.startsWith("A name long enough")),
    "the probe sees a row cropping its own contents"
  ).toBe(true);
});

/*
  A gallery that renders nothing passes every check above, so this asks that
  the thing being measured is actually there. It is the same trap the dock
  probe fell into once, where an empty room list measured an empty row and the
  width assertion passed while measuring nothing at all.

  The expected names are read out of the page's own source rather than counted
  by hand, so adding a case to the gallery and forgetting to check it renders
  is not a thing that can happen. A component that throws on the server takes
  its whole case with it, and this is what notices.
*/
const CASES = [
  ...readFileSync("src/app/gallery/page.tsx", "utf8").matchAll(/<Case name="([^"]+)"/g),
]
  .map((m) => m[1])
  /*
    The walkthrough's cases are named from its own data rather than written
    out, because there is one per screen and a ninth screen should not be able
    to arrive without being measured. That is one `<Case>` in TourCases.tsx
    with a template literal in it, which the regex above cannot read -- so the
    names are derived here the same way the component derives them, from the
    same file. Still read out of the source, still not counted by hand.
  */
  .concat(
    [
      ...readFileSync("src/lib/tour-steps.ts", "utf8").matchAll(/^    key: "([^"]+)",$/gm),
    ].map((m) => `tour-${m[1]!.toLowerCase()}`)
  );

test("the gallery is rendering the components it claims to", async ({ page }) => {
  expect(CASES.length, "cases were read out of the gallery source").toBeGreaterThan(10);

  await page.goto("/gallery");

  const rendered = await page.locator("[data-case]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-case") ?? "")
  );
  expect(rendered.sort(), "every case in the source reached the page").toEqual(
    [...CASES].sort()
  );

  // And that each of them drew something with contents, not an empty shell.
  for (const name of CASES) {
    const box = await page.locator(`[data-case="${name}"]`).boundingBox();
    expect(box?.height ?? 0, `${name} drew something`).toBeGreaterThan(40);
  }
});
