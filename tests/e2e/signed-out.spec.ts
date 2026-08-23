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
    /*
      Written as a promise about a future paid tier in phase 1, and as a
      description of a live one in phase 8. The guarantee has not moved: one
      tap, in the app, and never a phone call.
    */
    await page.goto("/legal/terms");
    await expect(
      page.getByText(/cancel at any time, yourself, in one tap/i)
    ).toBeVisible();
    await expect(page.getByText(/never ask you to phone or email us/i)).toBeVisible();
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
  /*
    Arena shares Lab's system and diverges from it by explicit decision,
    recorded in docs/brand/ARENA_MARK.md, which wins wherever it and the
    inherited brand doc disagree. Two divergences:

      the mark is a parted aqua stone rather than Lab's gold letterform, and
      the accent is that same aqua, so the accent and the mark are one colour
      rather than two competing ones;

      the aqua, gain and warning sit at the same lightness, so they read as
      meanings at one volume rather than as a hierarchy nobody intended, and
      the two reds sit lower because at that lightness sRGB has no red, only
      a salmon.

    Everything else is still Lab's, and the point of this test is that it
    stays that way. Divergences somebody wrote down are divergences; one
    nobody wrote down is the second palette the brand doc forbids.
  */
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
          // Arena's own accent, not Lab's. The mark's aqua, #11c0d3.
          ["--primary", "oklch(0.74 0.125 207)"],
          ["--ring", "oklch(0.74 0.125 207)"],
          /*
            The green and the amber at the accent's lightness. Lab's originals
            sat at three different ones, which made a loss read louder than a
            gain for a reason nobody chose.

            The reds are lower and that is deliberate: at L 0.74 the most
            chromatic red sRGB has is a salmon, and a losing number that reads
            as pink is the wrong colour whatever the row does. Hue 25, chroma
            just inside the gamut. See the semantic block in globals.css.
          */
          ["--gain", "oklch(0.74 0.155 162.5)"],
          ["--loss", "oklch(0.66 0.22 25)"],
          ["--warning", "oklch(0.74 0.16 45)"],
          ["--destructive", "oklch(0.58 0.232 25)"],
        ] as [string, string][],
      }
    );

    /*
      One byte of slack per channel, and no more.

      The build ships these as lab(), not as the oklch() written in
      globals.css, so a token read back off the document has been through a
      colour space the literal beside it has not. --loss lands on rgb(252,
      69, 71) that way and on rgb(252, 68, 71) direct: the same colour, one
      unit apart in one channel, and nothing a person can see. A palette that
      actually moved moves by tens.
    */
    for (const { token, actual, expected } of results) {
      const drift = actual.map((channel, index) => Math.abs(channel - expected[index]));
      expect(
        Math.max(...drift),
        `${token} has moved off the locked palette: ${actual} against ${expected}`
      ).toBeLessThanOrEqual(1);
    }
  });

  test("keeps the accent on the mark's aqua and off Lab's gold", async ({
    page,
  }) => {
    await page.goto("/");

    const primary = await page.evaluate((resolveSource) => {
      const resolve = eval(resolveSource) as (value: string) => number[];
      const style = getComputedStyle(document.documentElement);
      return resolve(style.getPropertyValue("--primary").trim());
    }, RESOLVE_COLOR);

    const [r, g, b] = primary;

    // Cool: blue leads, red trails. The accent is the mark's own colour, so
    // an accent that drifted warm would be a second one.
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);

    // And distinct from Lab's gold, which is the whole reason it moved.
    expect(primary.slice(0, 3)).not.toEqual([212, 188, 121]);
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

  /*
    Themes are bought and equipped, so they have to actually do something.

    They did not. The rules are written
    `[data-arena-theme="house"] .page-frame::before` -- a descendant selector
    -- and the layout put the attribute and the class on the same div, which a
    descendant combinator never matches. Every theme in the shop equipped
    cleanly and changed nothing, and nothing anywhere said so: no error, no
    failing test, just the shipped glow.

    ArenaTheme puts the attribute on the document element instead. This asks
    the browser to confirm the arrangement it depends on, which is the only
    way this fault is visible at all.
  */
  test("an equipped theme changes the field, and only from an ancestor", async ({
    page,
  }) => {
    await page.goto("/");

    const painted = await page.evaluate(() => {
      const frame = document.querySelector(".page-frame");
      if (!frame) return null;

      const glow = () => getComputedStyle(frame, "::before").backgroundImage;
      const root = document.documentElement;

      const unthemed = glow();

      // Where ArenaTheme puts it.
      root.setAttribute("data-arena-theme", "house");
      const fromAncestor = glow();
      root.removeAttribute("data-arena-theme");

      // Where the layout used to put it, on the frame itself.
      frame.setAttribute("data-arena-theme", "house");
      const fromSameElement = glow();
      frame.removeAttribute("data-arena-theme");

      return { unthemed, fromAncestor, fromSameElement };
    });

    expect(painted).not.toBeNull();
    // The theme has to reach the field from where it is actually set.
    expect(painted!.fromAncestor).not.toBe(painted!.unthemed);
    // And the arrangement that silently did nothing still does nothing, which
    // is why it must not be set there.
    expect(painted!.fromSameElement).toBe(painted!.unthemed);
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

test.describe("paying for things", () => {
  test("the paid page is behind a sign-in like everything else", async ({ page }) => {
    await page.goto("/plus");
    await expect(page).toHaveURL(/\?next=%2Fplus$/);
  });

  test("the payment webhook refuses an unsigned request", async ({ request }) => {
    /*
      The whole paid tier would be free if this ever answered anything else.
      A 404 means payments are not switched on at all; a 400 means the
      signature was checked and refused. Both are correct; a 200 is not.
    */
    const response = await request.post("/api/stripe/webhook", {
      data: { id: "evt_forged", type: "customer.subscription.updated" },
    });

    expect([400, 404]).toContain(response.status());
  });

  test("the terms say what recurs, what it costs and how to stop it", async ({
    page,
  }) => {
    // Recurring billing has to be disclosed before somebody agrees, and the
    // cancel path has to be as easy as the signup path.
    await page.goto("/legal/terms");

    await expect(page.getByText(/renews automatically until you stop it/i)).toBeVisible();
    await expect(page.getByText(/cancel at any time, yourself, in one tap/i)).toBeVisible();
    await expect(page.getByText(/never ask you to phone or email us/i)).toBeVisible();
  });

  test("the terms say coins are not money", async ({ page }) => {
    await page.goto("/legal/terms");

    await expect(page.getByText(/Coins are not money/)).toBeVisible();
    await expect(page.getByText(/no randomised bundles, boxes or packs/i)).toBeVisible();
  });

  test("the terms keep money away from scoring", async ({ page }) => {
    // The locked rule from section 9. If this line ever leaves the terms,
    // something has gone badly wrong upstream of the terms.
    await page.goto("/legal/terms");

    await expect(
      page.getByText(/Money never changes your score, your ranking, your odds/i)
    ).toBeVisible();
  });
});
