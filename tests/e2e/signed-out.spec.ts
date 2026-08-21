import { expect, test } from "@playwright/test";
import { oklchHue, resolveColorInPage as RESOLVE_COLOR } from "./color";

test.describe("landing", () => {
  test("shows the game, the age gate and the legal line", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Pick stocks with friends. Play money only." })
    ).toBeVisible();
    await expect(page.getByText("Not financial advice.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy policy" })).toBeVisible();
  });

  test("states the 16 age rule where it is read, not behind a tick box", async ({
    page,
  }) => {
    await page.goto("/");

    // Asserted in the same sentence as the terms, the way Upside Lab does it.
    // A separate checkbox only puts a dead button in front of a new visitor.
    await expect(
      page.getByText(/By continuing you confirm you are 16 or older/)
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  test("sign-in is usable the moment the page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Email me a link/ })).toBeEnabled();
  });

  test("the sign-in button is not covered by the cookie notice", async ({ page }) => {
    await page.goto("/");

    // A cookie notice sitting on top of the one thing a new visitor came to
    // do is worse than no notice at all. This caught exactly that on a phone.
    const clear = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        /Email me a link/.test(b.textContent ?? "")
      );
      const notice = document.querySelector('[role="dialog"]');
      if (!button || !notice) return true;
      const a = button.getBoundingClientRect();
      const b = notice.getBoundingClientRect();
      return a.bottom < b.top || a.top > b.bottom || a.right < b.left || a.left > b.right;
    });

    expect(clear).toBe(true);
  });
});

test.describe("legal", () => {
  for (const [path, heading] of [
    ["/legal/terms", "Terms"],
    ["/legal/privacy", "Privacy policy"],
  ] as const) {
    test(`${heading} is readable and versioned`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expect(page.getByText(/^Version \d{4}-\d{2}-\d{2}$/)).toBeVisible();
    });
  }

  test("terms state that nothing is redeemable and money never buys an edge", async ({
    page,
  }) => {
    await page.goto("/legal/terms");
    await expect(page.getByText(/no cash value/).first()).toBeVisible();
    await expect(
      page.getByText(/Nothing you can buy will ever change your score/)
    ).toBeVisible();
    await expect(page.getByText(/You must be 16 or older/)).toBeVisible();
  });

  test("privacy offers export, correction and deletion", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByText(/Show you what we hold/)).toBeVisible();
    await expect(page.getByText(/Delete your account and its data/)).toBeVisible();
    await expect(page.getByText(/Correct something that is wrong/)).toBeVisible();
  });

  test("privacy names a controller, a legal basis and a complaint route", async ({
    page,
  }) => {
    await page.goto("/legal/privacy");

    // The disclosures European law makes mandatory.
    await expect(page.getByText(/is the controller of your data/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Why we use it, and what allows us to/ })
    ).toBeVisible();
    await expect(page.getByText(/legitimate interest/).first()).toBeVisible();
    await expect(page.getByText(/standard contractual clauses/)).toBeVisible();
    await expect(page.getByText(/Andmekaitse Inspektsioon/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /How long we keep it/ })
    ).toBeVisible();
  });

  test("privacy states plainly that data is never sold", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByText(/We do not sell your data, and we never have/)).toBeVisible();
    await expect(
      page.getByText(/We do not sell your personal information/)
    ).toBeVisible();
  });

  test("privacy carries the California section", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(
      page.getByRole("heading", { name: /If you live in California/ })
    ).toBeVisible();
    await expect(page.getByText(/authorised agent/)).toBeVisible();
    await expect(
      page.getByText(/never deny you service, charge you a different price/)
    ).toBeVisible();
  });

  test("terms cover the clauses an agreement needs to be complete", async ({
    page,
  }) => {
    await page.goto("/legal/terms");

    for (const heading of [
      /Who you are dealing with/,
      /Limits on our responsibility/,
      /Changes to these terms/,
      /Which law applies, and where/,
      /Ending this agreement/,
      /Reporting something that should not be here/,
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("terms keep the consumer protections that cannot be signed away", async ({
    page,
  }) => {
    await page.goto("/legal/terms");

    // A blanket exclusion or a forced foreign forum would be unenforceable
    // against a consumer, so the document must not claim either.
    await expect(
      page.getByText(/rights under the law where you live that this section cannot take away/)
    ).toBeVisible();
    await expect(
      page.getByText(/bring a claim in the courts of the country you live in/)
    ).toBeVisible();
    await expect(
      page.getByText(/death or personal injury caused by our negligence/)
    ).toBeVisible();
  });

  test("terms promise cancellation is as easy as signing up", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(
      page.getByText(/cancel it yourself, in the app, as easily as you signed up/)
    ).toBeVisible();
    await expect(page.getByText(/never make you phone or email us to cancel/)).toBeVisible();
  });
});

test.describe("protected routes", () => {
  for (const path of ["/home", "/profile", "/onboarding"]) {
    test(`${path} is not reachable signed out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(\?|$)/);
      await expect(
        page.getByRole("heading", { name: /Pick stocks with friends/ })
      ).toBeVisible();
    });
  }

  test("the data export refuses an anonymous caller", async ({ request }) => {
    const response = await request.get("/api/account/export");
    expect(response.status()).toBe(401);
  });
});

test.describe("installable shell", () => {
  test("serves a manifest pointing at both icon purposes", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest.name).toBe("Upside Arena");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#000000");

    const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
  });

  test("serves a service worker that never caches API or auth responses", async ({
    request,
  }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBeTruthy();

    const source = await response.text();
    expect(source).toContain("/api/");
    expect(source).toContain("/auth/");
  });

  test("has an offline page for the worker to fall back to", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  });
});

test.describe("consent", () => {
  test("asks before measuring, and refusing is as easy as allowing", async ({
    page,
  }) => {
    await page.goto("/");

    const banner = page.getByRole("dialog", { name: "Optional measurement" });
    await expect(banner).toBeVisible();
    await expect(banner.getByText(/Sign-in cookies always run/)).toBeVisible();

    // Both choices must be equally reachable for the consent to be valid.
    await expect(banner.getByRole("button", { name: "Allow" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "No thanks" })).toBeVisible();
  });

  test("records nothing until consent is given", async ({ page }) => {
    await page.goto("/");

    const beforeChoice = await page.evaluate(
      () => window.localStorage.getItem("arena.consent.measurement")
    );
    expect(beforeChoice).toBeNull();

    await page.getByRole("button", { name: "No thanks" }).click();
    await expect(
      page.getByRole("dialog", { name: "Optional measurement" })
    ).toBeHidden();

    const afterChoice = await page.evaluate(
      () => window.localStorage.getItem("arena.consent.measurement")
    );
    expect(afterChoice).toBe("denied");
  });

  test("remembers the choice and stops asking", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Allow" }).click();

    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "Optional measurement" })
    ).toBeHidden();
  });

  /*
    The measurement script is absent until somebody says yes, rather than
    loaded and asked to behave. Mounting a vendor and trusting a flag is not
    consent, and it is the difference between the privacy policy being true
    and being aspirational.
  */

  test("loads no measurement script before a choice is made", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));

    await page.goto("/");
    await page.waitForTimeout(1000);

    expect(requested.filter((url) => url.includes("va.vercel-scripts.com"))).toEqual([]);
    expect(requested.filter((url) => url.includes("/_vercel/insights"))).toEqual([]);
  });

  test("loads no measurement script after a refusal", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "No thanks" }).click();

    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));

    await page.reload();
    await page.waitForTimeout(1000);

    expect(requested.filter((url) => url.includes("va.vercel-scripts.com"))).toEqual([]);
  });

  test("stops measuring again the moment consent is withdrawn", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Allow" }).click();

    // Withdrawing has to be as effective as never having agreed, not just as
    // easy. The stored answer is what every gate in the app reads.
    await page.evaluate(() => {
      window.localStorage.setItem("arena.consent.measurement", "denied");
      window.dispatchEvent(new Event("arena:consent-changed"));
    });

    const stored = await page.evaluate(() =>
      window.localStorage.getItem("arena.consent.measurement")
    );
    expect(stored).toBe("denied");
  });
});

test.describe("the numbers page", () => {
  test("is not there for somebody with no account", async ({ page }) => {
    // Owner only. A signed-out visitor is sent to sign in rather than shown
    // anything, and a signed-in stranger gets a plain not-found, so nobody
    // learns the page exists.
    await page.goto("/metrics");

    // Sent to sign in, carrying where they were headed, like any other
    // signed-in page. Nothing on the way says whether that page exists.
    await expect(page).toHaveURL(/\?next=%2Fmetrics$/);
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});

test.describe("brand shell", () => {
  test("paints the locked tokens, not a second palette", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(
      ({ expected, resolveSource }) => {
        const resolve = eval(resolveSource) as (value: string) => number[];
        const style = getComputedStyle(document.documentElement);

        return expected.map(([token, value]) => ({
          token,
          actual: resolve(style.getPropertyValue(token).trim()),
          expected: resolve(value),
        }));
      },
      {
        resolveSource: RESOLVE_COLOR,
        expected: [
          ["--background", "oklch(0 0 0)"],
          ["--foreground", "oklch(0.985 0 0)"],
          ["--card", "oklch(0.205 0 0)"],
          ["--muted", "oklch(0.269 0 0)"],
          ["--primary", "oklch(0.8 0.09 90)"],
          ["--ring", "oklch(0.8 0.09 90)"],
          ["--gain", "oklch(0.696 0.17 162.48)"],
          ["--loss", "oklch(0.645 0.21 16.439)"],
          ["--warning", "oklch(0.63 0.22 45)"],
        ] as [string, string][],
      }
    );

    for (const { token, actual, expected } of results) {
      expect(actual, `${token} must match Upside Lab`).toEqual(expected);
    }
  });

  test("carries no violet, purple or magenta anywhere in the palette", async ({
    page,
  }) => {
    await page.goto("/");

    const colors = await page.evaluate(
      ({ tokens, resolveSource }) => {
        const resolve = eval(resolveSource) as (value: string) => number[];
        const style = getComputedStyle(document.documentElement);
        return tokens.map((token) => ({
          token,
          rgb: resolve(style.getPropertyValue(token).trim()),
        }));
      },
      {
        resolveSource: RESOLVE_COLOR,
        tokens: [
          "--primary",
          "--gain",
          "--loss",
          "--warning",
          "--destructive",
          ...Array.from({ length: 10 }, (_, i) => `--cat-${i + 1}`),
        ],
      }
    );

    expect(colors.length).toBe(15);

    // Hues 270 to 330 are banned outright by the brand doc.
    for (const { token, rgb } of colors) {
      const hue = oklchHue(rgb);
      if (hue === null) continue;
      expect(hue < 268 || hue > 332, `${token} sits at hue ${hue.toFixed(0)}`).toBe(true);
    }
  });

  test("renders the field true black", async ({ page }) => {
    await page.goto("/");

    const { body, black } = await page.evaluate(
      ({ resolveSource }) => {
        const resolve = eval(resolveSource) as (value: string) => number[];
        return {
          body: resolve(getComputedStyle(document.body).backgroundColor),
          black: resolve("oklch(0 0 0)"),
        };
      },
      { resolveSource: RESOLVE_COLOR }
    );

    expect(body).toEqual(black);
  });

  test("money figures use tabular mono, never the UI face", async ({ page }) => {
    await page.goto("/");

    const figure = page.locator(".figure").first();
    const styles = await figure.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        family: style.fontFamily,
        numeric: style.fontVariantNumeric,
      };
    });

    expect(styles.family).toMatch(/Geist Mono|ui-monospace|monospace/);
    expect(styles.numeric).toContain("tabular-nums");
  });
});

test.describe("accessibility basics", () => {
  test("every page offers a skip link and one h1", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("the email field is labelled and typed", async ({ page }) => {
    await page.goto("/");
    const email = page.getByLabel("Email");
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
  });
});

test.describe("a shared week", () => {
  /*
    These links are posted into group chats. Everything below is about the one
    way this feature can fail completely: a stranger following the link and
    being asked to sign in instead of seeing the card. That turns the whole
    growth loop into a dead end, and it is one line in the proxy away from
    happening.
  */

  const link = "/w/0123456789abcdef0123456789abcdef";

  test("opens for somebody with no account", async ({ page }) => {
    const response = await page.goto(link);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${link}$`));
  });

  test("never bounces a visitor to sign in", async ({ page }) => {
    await page.goto(link);

    // A card that has gone is a card that has gone. It must not become a
    // sign-in wall, which is what a missing public path rule would produce.
    await expect(page.getByLabel("Email")).toHaveCount(0);
  });

  test("says plainly when a link no longer works, and blames nobody", async ({
    page,
  }) => {
    await page.goto(link);

    await expect(
      page.getByRole("heading", { name: "This card is no longer shared" })
    ).toBeVisible();
    await expect(page.getByText("Nothing is wrong on your end")).toBeVisible();
  });

  test("offers the visitor a way into the game", async ({ page }) => {
    // The only reason this page exists. A dead end here wastes the share.
    await page.goto(link);
    await expect(page.getByRole("link", { name: /Upside Arena/i })).toBeVisible();
  });

  test("asks not to be listed in search results", async ({ page }) => {
    await page.goto(link);

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  });

  test("still produces a picture for a link that has gone", async ({ request }) => {
    // A dead preview in a chat looks worse than a plain one, so the image
    // route has to answer even when there is no card behind it.
    const response = await request.get(`${link}/opengraph-image`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });
});
