# What the pages actually measure

Numbers rather than opinions, taken with `scripts/vitals.mjs` against a
production build. Re-run it after any change to the landing page and compare.

```
npm run build
npx next start --port 3200 &
node scripts/vitals.mjs
```

## Where it stands

Measured on 24 August 2026, on a local production build, desktop viewport,
median of three runs. TTFB is meaningless here (it is a loopback) and is left
in only because a sudden change in it would mean something was rendering that
used not to.

| Page | LCP | LCP, reduced motion | CLS | Long tasks |
|---|---|---|---|---|
| `/` | **not reported** | 700ms to 790ms | 0.000 | 1 to 2, worst ~330ms |
| `/how` | 230ms to 260ms | 210ms to 245ms | 0.000 | 0 to 1, worst ~55ms |
| `/legal/terms` | 220ms to 290ms | 210ms to 240ms | 0.000 | 0 to 1 |
| `/legal/privacy` | 220ms to 270ms | 210ms to 235ms | 0.000 | 0 to 1 |

**Cumulative layout shift is zero on every page.** Not "under the threshold",
zero: nothing on any of these pages moves after it is drawn. That is what the
fixed row heights, the reserved space and the fonts being loaded through
`next/font` buy, and it is the number most worth defending, because a page
that moves under a thumb is the failure a person actually feels.

## The landing page reports LCP again, and why it used not to

The table above is from 24 August 2026, **before** `.rise` was turned off on
the signed-out page. At that point the hero animated in from `opacity: 0`.
Chrome does not accept a transparent element as a candidate for Largest
Contentful Paint, and it does not go back and file one when the animation
finishes, so field tools showed nothing for `/` rather than something good.

That animation is now `none` on `.landing-field`. It was also the Safari
skip that left the below-fold half of the sample card unpainted until
scroll, so turning it off is a WebKit fix first and an LCP fix second. The
hero paints on the first frame. There is still **no bitmap on this page**:
the lockup is inline SVG, the stills are CSS, and Lab's landing is the same
shape, so there is nothing to preload, nothing to lazy-load, and no WebP
that older WebKit can fail to decode. LCP is the 64px headline waiting on
its webfont, which is why the reduced-motion column on that date (hero
visible immediately) still read slower than `/how`.

The document asks for three brand files (svg, ico, Apple's conventional
path). Putting the 16/32/48/192 PNGs in the HTML made Chrome fetch them
on `/` before the webfont; they already live in the manifest for install.

Re-run `scripts/vitals.mjs` after touching this page and replace the `/`
row. Do not leave "not reported" in the table once a run has a number.

The reduced-motion column on that date is what somebody who has asked for
less motion sees, and it is a real reading of how fast the page is: **the
hero is on the screen in about three quarters of a second**, against a
fifth of a second for the pages whose largest element is ordinary text.

## The one number that is not good enough

`/` spent **around 330 milliseconds in a single long task** on that date,
where every other page spent at most 60. That is hydration: the landing is a
server component but it carries the consent question, the scroll cue, the
page-view ping and analytics, and they all wake up at once. It used to
carry five arrival observers as well; those are gone, ported from Lab,
because they hid already-painted HTML and older WebKit skipped the
translated layer. The sign-in form is a server component too. The only
client piece on the button is `TrackSubmit`, which reports the tap. The
service worker waits for idle rather than racing the webfont.

Nobody is waiting on it in the sense that matters (there is one control on
the page and it is not usable any earlier or later than the paint), but a
third of a second of blocked main thread on a laptop is closer to a second
and a half on the phone somebody actually opens this on, and the whole of
that window is a tap that does nothing. Re-run `scripts/vitals.mjs` before
treating 330ms as current.

## What was found by measuring

**Reduced motion was not actually reducing anything on the first screen.** The
blanket rule cut animation *duration* to 0.01ms and left the *delay* and the
*fill* alone. `.rise` is `both`, so it holds its first keyframe, which is
`opacity: 0`, through a stagger that runs to 0.26s: somebody who had asked for
less motion watched a blank hero for a quarter of a second and then had the
whole thing appear at once, which is precisely what that setting exists to
prevent. Both are zeroed now, and the reduced-motion column above is the
proof: before the fix it reported no LCP either, because the hero was still
painting transparent.

## Market data at ten times the size

The audit asks what happens to the upstream bill as the game grows, and the
answer is in the shape of the caching rather than in a plan:

- A quote is fetched **once per symbol per minute** and shared by everybody
  (`src/lib/market/quotes.ts`), so a thousand players holding Apple cost one
  request between them. Cost scales with **distinct symbols held**, not with
  players.
- The movers panel is one batch for the whole watchlist, cached the same way,
  and it is the same batch for every player in the game.
- A week's settlement is one closing price per held symbol, once, and the
  answers are cached for the life of the process.
- The split check is one chart request per held symbol, once a day, claimed by
  one worker.

At MVP scale, with a few hundred distinct symbols held, that is a few hundred
requests a minute at the very worst and in practice far fewer, because the
watchlist is fixed and most players hold the same recognisable names. At ten
times the players the number barely moves: what would move it is ten times the
*symbols*, which needs players holding several hundred different companies
each. The lever if that ever happens is the cache lifetime, which is one
constant (`QUOTE_TTL_SECONDS`).
