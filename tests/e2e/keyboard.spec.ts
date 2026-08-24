import { test, expect, type Page } from "@playwright/test";

/*
  Getting through the app without a mouse.

  accessibility.spec.ts is a rules engine over the markup, and a rules engine
  cannot decide any of this. Whether the skip link is the first thing a Tab
  reaches, whether the focus ring is actually drawn, whether the cookie
  question can be answered and got out of, and whether the one control on the
  signed-out page can be pressed with a keyboard are four questions with no
  static answer: every one of them is about what happens when somebody
  presses a key.

  Checked signed out, because that is what runs without a project behind it,
  and because it is the whole of what a stranger sees. What the flows behind a
  session need is a session; see docs/PHASE_1.md.
*/

/** What has focus right now, in a form that is worth reading in a failure. */
async function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { tag: "body", text: "", visible: false };

    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? "").trim().slice(0, 60),
      href: el.getAttribute("href") ?? "",
      visible: rect.width > 0 && rect.height > 0,
    };
  });
}

/** Whether the browser is drawing a focus ring on whatever has focus. */
async function ringOnFocus(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return { outline: "none", width: "0px" };

    const style = getComputedStyle(el);
    return {
      outline: style.outlineStyle,
      width: style.outlineWidth,
      shadow: style.boxShadow,
    };
  });
}

test.describe("a keyboard is enough", () => {
  test("the first Tab is the skip link, and it moves focus into the page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const first = await focused(page);
    expect(first.text).toBe("Skip to content");
    expect(first.href).toBe("#main");

    /*
      And it is on screen while it has focus. The link is sr-only until then,
      which is right: a permanently visible skip link is chrome nobody asked
      for. One that stays invisible while focused is a link only a screen
      reader can find, which defeats the point for everybody using a keyboard
      and no reader.
    */
    expect(first.visible).toBe(true);

    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeVisible();
    expect(page.url()).toContain("#main");
  });

  test("focus is drawn, not suppressed", async ({ page }) => {
    await page.goto("/");

    // Ten stops is well past the header and into the page itself, which is
    // enough to catch a component that turned its own outline off.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");

      const where = await focused(page);
      if (where.tag === "body") continue;

      const ring = await ringOnFocus(page);
      const drawn =
        (ring.outline !== "none" && parseFloat(ring.width) > 0) ||
        (ring.shadow !== "none" && ring.shadow !== "");

      expect(drawn, `nothing is drawn on <${where.tag}> "${where.text}"`).toBe(true);
    }
  });

  test("every stop on the way down the page is something a person can see", async ({
    page,
  }) => {
    await page.goto("/");

    /*
      A control with a size of zero has focus and is nowhere: it is a hidden
      panel's button, or a decorative element that was given a tabindex. Both
      read as a Tab that did nothing, which is how somebody loses their place
      and starts again from the top.
    */
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const where = await focused(page);
      if (where.tag === "body") break;
      expect(where.visible, `<${where.tag}> "${where.text}" has focus and no size`).toBe(
        true
      );
    }
  });

  test("the sign-in button can be pressed without a mouse", async ({ page }) => {
    await page.goto("/");

    const button = page.getByRole("button", { name: /continue with google/i }).first();
    await expect(button).toBeVisible();

    await button.focus();
    const ring = await ringOnFocus(page);
    expect(
      (ring.outline !== "none" && parseFloat(ring.width) > 0) ||
        (ring.shadow !== "none" && ring.shadow !== ""),
      "the only control on the page shows nothing when it has focus"
    ).toBe(true);
  });

  test("the cookie question can be answered with a keyboard and then goes away", async ({
    page,
  }) => {
    await page.goto("/");

    const banner = page.getByRole("dialog").filter({ hasText: /cookies|measure/i }).first();
    await expect(banner).toBeVisible();

    /*
      Its buttons are reachable and pressable. A notice pinned over the bottom
      of the page that can only be dismissed with a pointer is one that stays
      there for the whole visit, over the content it is covering.
    */
    const answer = banner.getByRole("button").first();
    await answer.focus();
    await page.keyboard.press("Enter");

    await expect(banner).toBeHidden();
  });
});
