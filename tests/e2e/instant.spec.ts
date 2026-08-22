import { test, expect } from "@playwright/test";
import { instant } from "@next/playwright";

/*
  What is on screen in the first frame, before the server has answered.

  Every other test here waits for the page to settle and then asserts on it,
  which is the right thing for almost everything and cannot see this at all: a
  page that takes a second to paint and a page that paints instantly both pass
  those. `instant()` freezes the navigation at the point where only the shell
  exists, so what it asserts is exactly what a player sees while they wait.

  This is a structural property and it breaks quietly. One `await` moved above
  a `<Suspense>` boundary turns a room that painted on the tap into a room
  that paints when the database answers, and nothing else in this suite would
  notice.
*/

// A token that was never real. The card is gone, which is the state a share
// link spends most of its life in, and the frame is the same either way.
const SHARED = "/w/0123456789abcdef0123456789abcdef";

test.describe("The share page arrives before its card", () => {
  test("paints the wordmark and the invitation on the first frame", async ({
    page,
    baseURL,
  }) => {
    await instant(
      page,
      async () => {
        await page.goto(SHARED);

        // What this page exists to do, other than show the card: offer the
        // visitor a week of their own. It needs nothing from the server, so
        // it may not wait for the server.
        await expect(
          page.getByRole("heading", {
            name: "Everyone starts Monday with the same money",
          })
        ).toBeVisible();
        await expect(page.getByRole("link", { name: "Play a week" })).toBeVisible();

        // And the card's space is already being held at its real height, so
        // the invitation below does not jump when the week lands on it.
        await expect(page.locator('[aria-busy="true"]')).toBeVisible();

        // And the part that does need the server is genuinely still absent,
        // which is what stops this passing for the wrong reason: if the whole
        // page were being awaited, everything above would be here too.
        await expect(
          page.getByRole("heading", { name: "This card is no longer shared" })
        ).toHaveCount(0);
      },
      { baseURL }
    );

    // Released, the week resolves into the space the fallback was holding.
    await expect(
      page.getByRole("heading", { name: "This card is no longer shared" })
    ).toBeVisible();
  });
});
