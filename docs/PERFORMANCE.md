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

## The landing page reports no LCP, and that is worth understanding

The hero animates in from `opacity: 0` (`.rise` in `globals.css`). Chrome does
not accept a transparent element as a candidate for Largest Contentful Paint,
and it does not go back and file one when the animation finishes, so the
signed-out page produces **no LCP entry at all**. Field tools will show
nothing for it rather than something good.

That is a deliberate design decision, argued in `AGENTS.md`: the page is meant
to arrive rather than appear. What is worth being clear about is the cost, and
the cost is that the one number Google reads for this page does not exist.
Whoever wants it back knows where the lever is: it is the opacity term in
`@keyframes rise`, and a rise that only moves would keep most of the effect
and be measurable.

The reduced-motion column is what somebody who has asked for less motion
sees, and it is a real reading of how fast the page is: **the hero is on the
screen in about three quarters of a second**, against a fifth of a second for
the pages whose largest element is ordinary text. The difference is the hero's
64px display type waiting on its webfont; the smaller headings paint in the
fallback and are not repainted enough to move the mark.

## The one number that is not good enough

`/` spends **around 330 milliseconds in a single long task**, every time,
where every other page spends at most 60. That is hydration: the landing is a
server component but it carries the sign-in button, the consent question, the
arrival observer, the service worker registration and the ambient dither, and
they all wake up at once.

Nobody is waiting on it in the sense that matters (there is one control on the
page and it is not usable any earlier or later than the paint), but a third of
a second of blocked main thread on a laptop is closer to a second and a half
on the phone somebody actually opens this on, and the whole of that window is
a tap that does nothing. It is the first thing to look at if the landing page
is ever worked on again.

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
