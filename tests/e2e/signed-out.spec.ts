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

  test("the age gate asks for 16, matching Upside Lab", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("I am 16 or older.")).toBeVisible();
  });

  test("sign-in stays locked until the age box is ticked", async ({ page }) => {
    await page.goto("/");

    const emailButton = page.getByRole("button", { name: /Email me a sign-in link/ });
    await expect(emailButton).toBeDisabled();

    await page.getByRole("checkbox").check();
    await expect(emailButton).toBeEnabled();

    // Unticking has to lock it again, not just on first paint.
    await page.getByRole("checkbox").uncheck();
    await expect(emailButton).toBeDisabled();
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

  test("privacy offers export and deletion", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByText(/A copy of everything we hold about you/)).toBeVisible();
    await expect(page.getByText(/Deletion of your account/)).toBeVisible();
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

  test("the age checkbox is reachable and labelled", async ({ page }) => {
    await page.goto("/");
    const checkbox = page.getByRole("checkbox", { name: /I am 16 or older/ });
    await expect(checkbox).toBeVisible();

    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
  });

  test("the email field is labelled and typed", async ({ page }) => {
    await page.goto("/");
    const email = page.getByLabel("Email");
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
  });
});
