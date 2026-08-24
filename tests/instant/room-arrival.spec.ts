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
    /*
      Home once first, so what is measured is a room arriving rather than a
      cold cache filling. A player who has opened Home before is the case
      being asked about; the very first open of all is allowed to be slow and
      is a different question.
    */
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

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

        The panel that holds the holdings, because the invented player has
        some. It used to look for the empty-account panel instead, which a
        populated room does not draw at all -- a test written against the
        account the probe used to have rather than the one it has now.
      */
      await expect(page.getByText("What you own")).toBeVisible();

      /*
        And a holding in it, so an empty panel cannot pass for a full one.

        Scoped to that panel rather than to the page, and the reason is a
        failure this actually had: the same company can be in what moved
        today, marked as yours, and then "AAPL" is on the screen twice and a
        page-wide match is a strict mode violation rather than an assertion.
        Which of the recognisable companies moved most is not something this
        test gets to know, so it looks where the holding has to be.
      */
      const owned = page
        .locator("section")
        .filter({ hasText: "What you own" })
        // The innermost match: an ancestor section holding the whole room
        // would contain the heading too, and comes first in document order.
        .last();
      await expect(owned.getByText("AAPL")).toBeVisible();

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
    And the rest of the rooms, each arriving from somewhere else.

    Every room reads the session, so a hole at that root shows up in all of
    them -- but each also reads things no other room does, and a hole in one
    of those would only ever show up here. Two rooms were watched when this
    was written, which is the coverage that let a loading.tsx sit above all
    five while a test checked one directory at a time.

    Driven by clicking a link rather than by loading the page, because a
    client navigation only re-renders below the layout two routes share, and
    a link is how a player actually moves. Each row says which page that
    link is on.
  */
  const ROOMS = [
    // Each with a string that can only be on screen if the room's own data
    // arrived with it, rather than after it, and the page a player is on
    // when they go there.
    { from: "/home", href: "/trade", reads: "the portfolio and the lineup", figure: "$" },
    {
      from: "/home",
      href: "/leagues",
      reads: "standings, pods and battles",
      figure: "not in a league yet",
    },
    {
      from: "/home",
      href: "/profile",
      reads: "the wardrobe, the record and the cards",
      figure: NAME,
    },
    /*
      Season is reached from Profile, not from the dock.

      It left the bar because every figure in it was settled on a Friday and
      has not been touched since, which is a record rather than a room, and
      Profile is where the rest of a player's record lives. The room still
      has to arrive whole, so it is still measured here; only the door
      moved. Starting from Profile is the point rather than a detail -- if
      that link ever stops being drawn, this fails, and a season table
      nothing links to is a room nobody can open.
    */
    { from: "/profile", href: "/season", reads: "the season table", figure: "Season" },
  ] as const;

  for (const { from, href, reads, figure: FIGURE } of ROOMS) {
    test(`${href} arrives whole too, and it reads ${reads}`, async ({ page }) => {
      await page.goto(from);
      await page.waitForLoadState("networkidle");

      let firstFrame = "";

      await instant(page, async () => {
        await page.click(`a[href="${href}"]`);
        await page.waitForURL((url) => url.pathname === href);

        /*
          A heading, and then something that only exists once the room has its
          data. A heading alone is too weak a claim: Trade passed this check
          for a while with a clock read that cost it its entire shell, because
          the heading is static and arrives either way. What catches that is
          asking for a figure that had to come from somewhere.
        */
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("body")).toContainText(FIGURE);

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
