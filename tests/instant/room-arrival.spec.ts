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

/*
  The consent notice decides for itself when to appear and is not part of a
  room, so it is taken out before two frames are compared.
*/
function room(text: string) {
  return text
    .split("\n")
    .filter(
      (line) =>
        !line.includes("Measuring page views") &&
        line.trim() !== "Allow" &&
        line.trim() !== "No thanks"
    )
    .join("\n")
    .trim();
}

test.describe("a room arrives whole", () => {
  test("home is complete in the first frame of a tap from profile", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    let firstFrame = "";

    await instant(page, async () => {
      await page.click('a[href="/home"]');
      await page.waitForURL((url) => url.pathname === "/home");

      /*
        The player's own name. It comes from the session, which is read from a
        cookie, and a cookie read outside a cached scope cannot be prerendered
        -- so this is the first thing to go when the root of the room turns
        dynamic again. With that regression in place the greeting reads "Hi"
        and stops there.
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

      firstFrame = room(await page.locator("body").innerText());
    });

    /*
      And the assertion that does not depend on knowing what to look for.

      Naming things that must be present only catches the regions somebody
      thought to name. This says the room does not change after the frame the
      tap painted -- which is the whole of what was asked for, and the only
      form of it that covers a region nobody has thought of yet.
    */
    await page.waitForLoadState("networkidle");
    const settled = room(await page.locator("body").innerText());

    expect(
      settled,
      "something arrived after the first frame, which is a region streaming in"
    ).toBe(firstFrame);
  });

  /*
    And the rest of the dock, each arriving from somewhere else.

    Every room reads the session, so a hole at that root shows up in all of
    them -- but each also reads things no other room does, and a hole in one
    of those would only ever show up here. Two rooms were watched when this
    was written, which is the coverage that let a loading.tsx sit above all
    five while a test checked one directory at a time.

    Driven from Home rather than from a fixed page, because a client
    navigation only re-renders below the layout two routes share, and the dock
    is how a player actually moves.
  */
  const ROOMS = [
    ["/trade", "the portfolio and the lineup"],
    ["/leagues", "standings, pods and battles"],
    ["/season", "the season table"],
    ["/profile", "the wardrobe, the record and the cards"],
  ] as const;

  for (const [href, reads] of ROOMS) {
    test(`${href} arrives whole too, and it reads ${reads}`, async ({ page }) => {
      await page.goto("/home");
      await page.waitForLoadState("networkidle");

      let firstFrame = "";

      await instant(page, async () => {
        await page.click(`a[href="${href}"]`);
        await page.waitForURL((url) => url.pathname === href);

        // A room that painted nothing has no heading, which is the failure
        // this would otherwise pass straight through.
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        firstFrame = room(await page.locator("body").innerText());
      });

      await page.waitForLoadState("networkidle");

      expect(
        room(await page.locator("body").innerText()),
        `${href} changed after the first frame, which is a region streaming in`
      ).toBe(firstFrame);
    });
  }
});
