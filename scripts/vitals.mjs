/*
  Core Web Vitals on the pages a stranger sees, measured rather than assumed.

    npm run build
    npx next start --port 3200 &
    node scripts/vitals.mjs

  Nothing here is a benchmark of the host. What it measures is the shape of
  the page: how much of it is layout that moves after it is drawn, how late
  the largest thing arrives, and how much of the main thread the app spends
  before it is usable. Those are properties of what was built and they are the
  same on any machine, which is why they are worth writing down and comparing
  against later rather than reading once and forgetting.

  Signed-out pages only, deliberately. They are what somebody judges Arena on
  before there is an account, and they are the ones that need no project
  behind them, so this can be run anywhere by anybody.

  BASE_URL overrides the port. PLAYWRIGHT_CHROMIUM_PATH points at a browser
  when the sandbox ships its own.
*/
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3200";
const PAGES = ["/", "/how", "/legal/terms", "/legal/privacy"];

/*
  Every page is measured twice, and the reason is worth knowing before reading
  the numbers.

  The signed-out page's hero animates in from `opacity: 0` (the `.rise` rule
  in globals.css, up to 0.26s of stagger and half a second of fade). Chrome
  does not treat a transparent element as a candidate for Largest Contentful
  Paint, and it does not go back and file one when the animation finishes
  either, so **the landing page reports no LCP at all**. That is not a fast
  page, it is an unmeasured one, and reading a missing number as a good one is
  how a page gets slower without anybody noticing.

  So: one pass as most visitors get it, which says whether an LCP exists to
  report at all, and one with the browser asking for reduced motion, which the
  stylesheet already answers by drawing everything at once. The second is not
  a trick to make the number look better: it is what a real share of people
  actually see, and it is the only way to find out how quickly the server and
  the browser got the largest thing onto the screen. It is the number to
  compare against next time.
*/

/** What the browser will tell us about a page it has just drawn. */
const COLLECT = `
  new Promise((resolve) => {
    const out = { lcp: 0, cls: 0, longTasks: 0, longest: 0 };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) out.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });

    /*
      Layout shift, excluding anything a person caused. A shift after a click
      is a page responding; a shift nobody asked for is the page moving under
      whatever they were about to press.
    */
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) out.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });

    /*
      Long tasks stand in for INP, which cannot be measured without somebody
      to do the interacting. Fifty milliseconds is the threshold at which the
      main thread stops answering, so the count and the worst one together
      say whether a tap would have waited.
    */
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        out.longTasks += 1;
        out.longest = Math.max(out.longest, entry.duration);
      }
    }).observe({ type: "longtask", buffered: true });

    // Long enough for the fonts, the hydration and anything that arrives late.
    setTimeout(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      out.ttfb = nav ? nav.responseStart : 0;
      out.loaded = nav ? nav.loadEventEnd : 0;
      resolve(out);
    }, 4000);
  })
`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
});

const rows = [];

async function measure(path, stillness) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    // The stylesheet already answers this by drawing everything at once, so
    // asking for it is how the page is measured without an animation in the
    // way, and it is what a real share of people see rather than a trick.
    reducedMotion: stillness ? "reduce" : "no-preference",
  });
  const page = await context.newPage();

  // The cookie question is a dialog over the page and would be measured as
  // part of it. Answered before the first paint, as a returning visitor's is.
  await page.addInitScript(() => {
    window.localStorage.setItem("arena.consent.measurement", "denied");
  });

  await page.goto(BASE + path, { waitUntil: "load" });
  const result = await page.evaluate(COLLECT);
  await context.close();
  return result;
}

for (const path of PAGES) {
  const asShipped = await measure(path, false);
  const still = await measure(path, true);
  rows.push({ path, ...asShipped, stillLcp: still.lcp });
}

await browser.close();

const cell = (text, width) => String(text).padEnd(width);

console.log(
  cell("page", 18) +
    cell("ttfb", 9) +
    cell("lcp", 11) +
    cell("still", 10) +
    cell("cls", 9) +
    "long tasks"
);

for (const row of rows) {
  console.log(
    cell(row.path, 18) +
      cell(`${Math.round(row.ttfb)}ms`, 9) +
      cell(row.lcp ? `${Math.round(row.lcp)}ms` : "none", 11) +
      cell(row.stillLcp ? `${Math.round(row.stillLcp)}ms` : "none", 10) +
      cell(row.cls.toFixed(4), 9) +
      `${row.longTasks}${row.longest ? ` (worst ${Math.round(row.longest)}ms)` : ""}`
  );
}

const unmeasured = rows.filter((row) => !row.lcp);
if (unmeasured.length > 0) {
  console.log("");
  console.log(
    `no LCP is reported for ${unmeasured.map((row) => row.path).join(", ")}: ` +
      "the largest thing on the page is transparent when it is painted. The " +
      "still column is what somebody who asks for reduced motion gets."
  );
}

/*
  The thresholds Google publishes for "good", so a number that has drifted
  says so rather than sitting in a table waiting to be compared by hand.
*/
const BAD = rows.filter(
  (row) => (row.lcp || row.stillLcp) > 2500 || row.cls > 0.1
);

if (BAD.length > 0) {
  console.log("");
  for (const row of BAD) {
    console.log(
      `${row.path} is outside what counts as good: lcp ${Math.round(row.lcp)}ms, cls ${row.cls.toFixed(4)}`
    );
  }
  process.exitCode = 1;
}
