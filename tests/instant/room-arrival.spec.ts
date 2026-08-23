import { test, expect } from "@playwright/test";
import { instant } from "@next/playwright";

/*
  What is on screen in the frame a tap paints.

  This is the only test in this repository that can see the thing four
  attempts at "make it faster" were aimed at and missed. Every other browser
  test waits for the page to settle before asserting, which means a room that
  arrives whole and a room that assembles itself over a second both pass.

  instant() freezes the navigation at the point where only what was prefetched
  exists. So what it asserts is what a player sees while they wait -- and if
  they wait for nothing, that is the whole room.

  The failure it exists to catch is not a broken room. It is a room that works
  perfectly and arrives in pieces, which nothing else here can tell from a
  room that does not.
*/

const NAME = "Probe"; // The invented player's display name. See lib/profile.

test.describe("a room arrives whole", () => {
  test("home is complete in the first frame of a tap from profile", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    await instant(page, async () => {
      await page.click('a[href="/home"]');
      await page.waitForURL((url) => url.pathname === "/home");

      /*
        The player's own name. It comes from the session, which is read from a
        cookie, and a cookie read outside a cached scope cannot be prerendered
        -- so this is the first thing to go when the root of the room turns
        dynamic again. With the regression in place the greeting reads "Hi"
        and stops.
      */
      await expect(page.getByRole("heading", { level: 1 })).toContainText(NAME);

      /*
        And the body. Everything below the scoreboard sits behind one boundary
        whose fallback is null, so when it is not prefetched the room is a
        heading, four dashes and nothing else -- an empty page that fills in
        afterwards, which is exactly what was being reported.
      */
      await expect(
        page.getByText("Your first week has not started yet")
      ).toBeVisible();
    });
  });

  test("and so does trade, which reads the same session and portfolio", async ({
    page,
  }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await instant(page, async () => {
      await page.click('a[href="/trade"]');
      await page.waitForURL((url) => url.pathname === "/trade");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });
});
