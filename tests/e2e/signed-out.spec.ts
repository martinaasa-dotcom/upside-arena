import { expect, test } from "@playwright/test";
import { oklchHue, resolveColorInPage as RESOLVE_COLOR } from "./color";

test.describe("landing", () => {
  test("shows the game, the age gate and the legal line", async ({ page }) => {
    await page.goto("/");

    /*
      The hero names the problem before it names the product, which is the
      whole shape of the page. If this heading is ever the product again, the
      page has been rebuilt as a sign-in box with a tour bolted under it.
    */
    await expect(
      page.getByRole("heading", {
        name: "Everyone has a stock pick. Nobody keeps score.",
        level: 1,
      })
    ).toBeVisible();
    /*
      The consent sentence sits with the button that constitutes consenting,
      and there are two such buttons, so there are two of it. `.first()` rather
      than a count, because where it appears is a layout decision and this
      test is about it being on the page at all.
    */
    await expect(
      page.getByRole("link", { name: "Terms", exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Privacy policy" }).first()
    ).toBeVisible();
  });

  test("puts the consent sentence beside every button that signs you in", async ({
    page,
  }) => {
    await page.goto("/");

    /*
      Somebody who signs up from the closing ask has to have been told the same
      thing as somebody who signed up from the hero.

      The buttons stream in behind a Suspense boundary, so counting them
      straight after `goto` counted zero on a phone and passed vacuously on a
      desktop. Wait for one to exist before asking how many there are.
    */
    const google = page.getByRole("button", { name: "Continue with Google" });
    await expect(google.first()).toBeVisible();

    const buttons = await google.count();
    expect(buttons).toBeGreaterThan(0);
    await expect(
      page.getByText(/By continuing you confirm you are 16 or older/)
    ).toHaveCount(buttons);
  });

  /*
    The two questions every visitor has after "what is it", in the order they
    are asked. Both were answered nowhere on the page this one replaced, and
    a free game that does not say what the paid thing buys reads as one with
    something to hide.
  */
  test("answers what it costs and what is at stake, without signing in", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByText("Nothing. The free game is the whole game.")
    ).toBeVisible();
    await expect(
      page.getByText(/It cannot move a score, a ranking or what anybody is allowed to trade/)
    ).toBeVisible();
    await expect(page.getByText(/The money is pretend/)).toBeVisible();
    await expect(page.getByText(/Arena is not a broker/)).toBeVisible();
  });

  /*
    Google is the only way in, and it is the whole of the way in.

    The magic link went on 2026-08-23. Everything it needed existed to get an
    address right that Google already has right, and every one of those steps
    was a way for somebody to fail to reach their own account.
  */
  test("offers Google and nothing else", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Continue with Google" }).first()
    ).toBeEnabled();

    // No address field, no "email me a link", nowhere to mistype anything.
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /link/i })).toHaveCount(0);
  });

  test("repeats the ask at the bottom, and it is the real button", async ({
    page,
  }) => {
    await page.goto("/");

    /*
      Two, and both of them sign you in. Nobody who has read to the end of the
      page should have to scroll back up to act on it, and with one button
      there is nothing to duplicate: no second form, no second field.
    */
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toHaveCount(2);
  });

  test("states the 16 age rule where it is read, not behind a tick box", async ({
    page,
  }) => {
    await page.goto("/");

    // Asserted in the same sentence as the terms, the way Upside Lab does it.
    // A separate checkbox only puts a dead button in front of a new visitor.
    // One per sign-in button, so this names the first; the test below is the
    // one that cares how many there are.
    await expect(
      page.getByText(/By continuing you confirm you are 16 or older/).first()
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  test("sign-in is usable the moment the page loads", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Continue with Google" }).first()
    ).toBeEnabled();
  });

  /*
    Scrolling. The feedback: somebody scrolls a landing page, lands in
    black, and concludes it is over, so they scroll back up and never see
    the rest of it.

    That used to be an IntersectionObserver fade, ported from Lab and then
    dropped there when the field split: script hid HTML the browser had
    already painted, and older WebKit skipped a translated layer until it
    scrolled on-screen. These walk the real page rather than reading a
    class name, because a settled snapshot cannot tell the difference.
  */

  test("never leaves a section arriving where it can be watched", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "No thanks" }).click();

    expect(await page.locator("[data-reveal]").count()).toBe(0);

    const height = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );

    const caught: string[] = [];
    /*
      100px steps. A section used to spend about 140px of scrolling visible
      and unpainted, and every interval that long contains a multiple of
      100, so a return of that fault cannot slip between two stops.
    */
    for (let y = 0; y <= height; y += 100) {
      const at = Math.min(y, height);
      await page.evaluate((v) => window.scrollTo(0, v), at);
      await page.waitForTimeout(60);

      const showing = await page.evaluate(() => {
        const vh = window.innerHeight;
        return [...document.querySelectorAll("main h2, main h3")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return (
              r.bottom > 8 &&
              r.top < vh - 8 &&
              (Number(cs.opacity) === 0 || cs.visibility === "hidden")
            );
          })
          .map((el) => (el.textContent ?? "").trim().slice(0, 40));
      });
      for (const label of showing) caught.push(`at y=${at}: ${label}`);
    }

    expect(caught, "sections still unpainted while on screen").toEqual([]);
  });

  test("leaves no empty band a reader could mistake for the end", async ({
    page,
  }) => {
    await page.goto("/");

    // Answer the cookie question first. The room it needs is real, occupied
    // space, and it is not what this is about.
    await page.getByRole("button", { name: "No thanks" }).click();
    await expect(
      page.getByRole("dialog", { name: "Optional measurement" })
    ).toBeHidden();

    const { worst, viewport } = await page.evaluate(() => {
      const doc = Math.round(document.documentElement.scrollHeight);
      const painted = new Uint8Array(doc + 2);
      const TEXT = "p,h1,h2,h3,h4,li,button,input,img,svg,span,td,th";
      const drawn = (cs: CSSStyleDeclaration) =>
        (cs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
          cs.backgroundColor !== "transparent") ||
        cs.backgroundImage !== "none" ||
        cs.borderTopWidth !== "0px" ||
        cs.boxShadow !== "none";

      for (const el of document.querySelectorAll("*")) {
        if (el.tagName === "HTML" || el.tagName === "BODY") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        // The ambient field is the room's light, not content.
        if (r.height > window.innerHeight * 3) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.opacity === "0") continue;
        if (!el.matches(TEXT) && !drawn(cs)) continue;
        const top = Math.max(0, Math.round(r.top + window.scrollY));
        const bottom = Math.min(doc, Math.round(r.bottom + window.scrollY));
        for (let y = top; y < bottom; y++) painted[y] = 1;
      }

      let run = 0;
      let worst = 0;
      for (let y = 0; y <= doc; y++) {
        run = painted[y] ? 0 : run + 1;
        if (run > worst) worst = run;
      }
      return { worst, viewport: window.innerHeight };
    });

    // A quarter of a screen. Past that, one flick can put a reader somewhere
    // with nothing at all in front of them.
    expect(
      worst,
      `${worst}px of nothing in a ${viewport}px window`
    ).toBeLessThan(viewport / 4);
  });

  test("visibly runs past the fold rather than ending flush with it", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "No thanks" }).click();

    // Content severed by the bottom edge is this page's whole scroll
    // affordance, and it beats an arrow that would have to sit off-screen to
    // be seen. It only works while something is really cut.
    const cut = await page.evaluate(() => {
      const vh = window.innerHeight;
      if (document.documentElement.scrollHeight <= vh + 1) return "fits";
      for (const el of document.querySelectorAll("main .glass, main li, main p")) {
        const r = el.getBoundingClientRect();
        if (r.top < vh - 24 && r.bottom > vh + 24) return "cut";
      }
      return "flush";
    });

    expect(cut, "a page that scrolls but ends flush with the fold").not.toBe(
      "flush"
    );
  });

  test("the sign-in button is not covered by the cookie notice", async ({ page }) => {
    await page.goto("/");

    // A cookie notice sitting on top of the one thing a new visitor came to
    // do is worse than no notice at all. This caught exactly that on a phone.
    const clear = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        /Continue with Google/.test(b.textContent ?? "")
      );
      const notice = document.querySelector('[role="dialog"]');
      if (!button || !notice) return true;
      const a = button.getBoundingClientRect();
      const b = notice.getBoundingClientRect();
      return a.bottom < b.top || a.top > b.bottom || a.right < b.left || a.left > b.right;
    });

    expect(clear).toBe(true);
  });

  /*
    The page has an end to it. A landing page that simply stops is a page with
    nothing behind it, and this is also where the advice disclaimer moved to
    when it came out of the hero.
  */
  test("ends in a footer that says what Arena is not", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");

    await expect(footer.getByText(/Play money only/)).toBeVisible();
    await expect(footer.getByText(/Not financial advice/)).toBeVisible();
    await expect(footer.getByRole("link", { name: "How Arena works" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Terms of use" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Privacy" })).toBeVisible();
  });

  test("says the page continues only when the page is not saying it", async ({
    page,
  }) => {
    await page.goto("/");

    /*
      A landing page that reads as finished at the fold is one nobody
      scrolls, and the sections under the hero are most of what this page
      has to say. But the page has three ways of ending a first screen and
      only one of them wants words, so what this walks is which one the
      window it is running in actually produced.

      1. The sample card is cut by the fold. That is the loudest
         continuation cue there is and it is what a phone always gets.
      2. The next section has reached the screen, which is what the hero's
         own height floor arranges on a tall display.
      3. Neither, and the first screen ends clean. That is the one case the
         cue exists for.

      The old version of this asserted the cue was visible on any page that
      scrolled at all, which is precisely the behaviour that put a floating
      pill over a card already hanging off the bottom of every phone.
    */
    const noThanks = page.getByRole("button", { name: "No thanks" });
    if (await noThanks.isVisible()) await noThanks.click();

    const cue = page.getByRole("button", { name: /More below/ });

    const first = await page.evaluate(() => {
      const doc = document.scrollingElement!;
      const vh = window.innerHeight;
      const still = document.querySelector("[data-scroll-cue-still]")!;
      const hero = document.querySelector("main > section")!;
      const next = hero.nextElementSibling!.firstElementChild!;
      return {
        scrolls: doc.scrollHeight - doc.clientHeight > 240,
        cardCut: still.getBoundingClientRect().bottom > vh,
        nextReached: next.getBoundingClientRect().top < vh,
        vh,
      };
    });

    if (!first.scrolls || first.cardCut || first.nextReached) {
      await expect(cue).toBeHidden();
      return;
    }

    await expect(cue).toBeVisible();

    /*
      In the band at the bottom of the first screen, which is the one moment
      it is any use, and clear of the card above it. The old chevron on
      Upside Lab was laid out under the card, which is to say off screen at
      exactly the moment the hint was needed.
    */
    const placed = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        /More below/.test(b.textContent ?? "")
      )!;
      const box = btn.getBoundingClientRect();
      const card = document
        .querySelector("[data-scroll-cue-still]")!
        .getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        clearOfCard: box.top - card.bottom,
        // Nothing about it may be pinned to the window, and nothing about
        // it may filter its backdrop. Both together were what made the page
        // repaint its bottom band on every frame of a scroll.
        position: getComputedStyle(btn.parentElement!).position,
        backdrop: getComputedStyle(btn).backdropFilter,
      };
    });
    expect(placed.position).toBe("absolute");
    expect(placed.backdrop === "none" || placed.backdrop === "").toBe(true);
    expect(placed.top).toBeGreaterThan(first.vh * 0.6);
    expect(placed.bottom).toBeLessThanOrEqual(first.vh);
    expect(placed.clearOfCard).toBeGreaterThanOrEqual(0);

    // And it stops saying it the moment they act on it.
    await page.mouse.wheel(0, 400);
    await expect(cue).toBeHidden();
  });

  test("says it on a reload, rather than waiting to be scrolled", async ({
    page,
  }) => {
    /*
      The whole point of the cue is the reader who has not scrolled yet, so
      the one measurement that matters is the first one. It used to be taken
      while the hero still held the sample card 8px below where it lands,
      until 0.76s in. Read off a rect, that put the card past the band on
      any window where it settles closer than the animation travels, the
      cue stood down, and nothing measured again until the reader scrolled,
      which is the moment the answer stops being any use. The animation is
      gone; a font swap still moves more than the few pixels of clearance
      this decides on, so the cue still reads layout. Measured on Upside
      Lab's copy: no cue at all between 950px and 961px tall.

      So this builds that window rather than hoping CI runs in one. The
      window is sized off where the card really ends, leaving it a few
      pixels clear of the band, and the assertion is that a reload alone is
      enough.
    */
    await page.goto("/");
    const noThanks = page.getByRole("button", { name: "No thanks" });
    if (await noThanks.isVisible()) await noThanks.click();

    const card = await page.evaluate(() => {
      const still = document.querySelector<HTMLElement>(
        "[data-scroll-cue-still]"
      )!;
      let top = 0;
      for (
        let el: HTMLElement | null = still;
        el;
        el = el.offsetParent as HTMLElement | null
      ) {
        top += el.offsetTop;
      }
      return top + still.offsetHeight;
    });

    // The band is the last 3.5rem of the first screen. Six pixels of
    // clearance is inside what the entrance animation travels and outside
    // nothing.
    const width = page.viewportSize()!.width;
    await page.setViewportSize({ width, height: card + 56 + 6 });
    await page.goto("/");

    const cue = page.getByRole("button", { name: /More below/ });
    await expect(cue).toBeVisible({ timeout: 5000 });
    // And it got there on its own, with the page still where it opened.
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(
      0
    );
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
        page.getByRole("heading", { name: /Everyone has a stock pick/ })
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
    await expect(
      page.getByRole("button", { name: "Continue with Google" }).first()
    ).toBeVisible();
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

  test("the sign-in button is a real button with a real name", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Continue with Google" }).first();
    await expect(button).toHaveAttribute("type", "submit");
    // The mark beside the label is decoration, so the name is the words alone.
    await expect(button).toHaveAccessibleName("Continue with Google");
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
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toHaveCount(0);
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
