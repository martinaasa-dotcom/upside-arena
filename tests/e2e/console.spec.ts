import { test, expect, type ConsoleMessage } from "@playwright/test";

/*
  Nothing shouts into the console on a page a stranger can reach.

  A console error in production is one of two things and both are worth
  knowing about: something actually failed, or something used to fail and the
  message stayed. React's hydration mismatches, a missing key, a violated
  Content Security Policy and a 404 on an asset all arrive here and nowhere
  else, and every one of them is invisible from the outside until it is the
  reason a screen is blank.

  Errors and warnings both. A warning that nobody reads is how a page ends up
  with nine of them, at which point the tenth, which is the real one, is
  indistinguishable from the noise.
*/

const PAGES = ["/", "/how", "/legal/privacy", "/legal/terms", "/offline", "/auth/no-such-page"];

/*
  What is allowed to be said, and why. Every entry here is something the
  browser says about the world rather than about Arena.
*/
const EXPECTED = [
  // A page that is deliberately not there answers 404, and Chrome logs it.
  /Failed to load resource: the server responded with a status of 404/,
  // The placeholder Supabase project this suite runs against is a closed
  // port, on purpose. See playwright.config.ts.
  /net::ERR_CONNECTION_REFUSED/,
  /Failed to load resource: net::ERR/,
];

function unexpected(message: ConsoleMessage): boolean {
  if (message.type() !== "error" && message.type() !== "warning") return false;
  return !EXPECTED.some((pattern) => pattern.test(message.text()));
}

for (const path of PAGES) {
  test(`${path} says nothing to the console`, async ({ page }) => {
    const said: string[] = [];

    page.on("console", (message) => {
      if (unexpected(message)) said.push(`${message.type()}: ${message.text()}`);
    });

    /*
      An exception that escapes is worse than anything in the console and is
      reported separately by the browser, so it is caught here too rather
      than left to whichever test happens to notice the damage.
    */
    page.on("pageerror", (error) => said.push(`uncaught: ${error.message}`));

    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);

    // Hydration finishes after load, and hydration is what most of these
    // messages are about, so the page is given a moment to say them.
    await page.waitForTimeout(1500);

    expect(said, said.join("\n")).toEqual([]);
  });
}

/*
  And the check itself, checked.

  A probe that watches for something which never happens passes whether or not
  it is still wired up. This one makes the page say something and asserts that
  it was heard, which is the difference between a guard and a habit.
*/
test("the check hears a page that does say something", async ({ page }) => {
  const said: string[] = [];

  page.on("console", (message) => {
    if (unexpected(message)) said.push(`${message.type()}: ${message.text()}`);
  });

  await page.goto("/");
  await page.evaluate(() => {
    console.error("a message nobody should be shipping");
    console.warn("nor this one");
  });

  expect(said).toHaveLength(2);
  expect(said[0]).toContain("nobody should be shipping");
});
