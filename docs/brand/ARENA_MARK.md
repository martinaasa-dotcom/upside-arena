# The Arena mark

Arena's mark is a single eight-sided stone, parted along its diagonal, cut
from aqua. It is called Cleave. It ships in `src/components/brand/ArenaMark.tsx`.

This document records what was decided and why, so the next person does not
have to reconstruct it from the branch history.

---

## What it is

One six-sided stone with an upward chevron channel cut clean through it. It is
called Rift.

The channel is the mark. The stone is only there to hold it, which is why the
two masses are shaded as one object rather than as a matched pair: the upper
band is lit from the left and notched from beneath, the lower mass peaks into
the gap and carries the brightest facet on its left flank.

It says upside without drawing an arrow, a chart line or a mountain, and the
thing a reader actually remembers is the empty shape between two solids.

### Construction, shared with Lab

This part is deliberately identical to Lab's mark and must stay that way:

- flat facets, no strokes, transparent ground
- the 64 grid
- each facet drawn full-size then scaled `0.93` toward its own centroid, which
  is what produces the even hairline cuts

Only the silhouette and the metal differ. Lab is a solid standing "A" in warm
gold; Arena is a channelled stone in aqua. Siblings, not twins.

### Geometry

A pointy-top hexagon of radius 28 about (32, 32). The channel's upper edge runs
(7.8, 30) to (32, 12) to (56.2, 30); its lower edge runs (7.8, 40) to (32, 22)
to (56.2, 40). Each of the two resulting masses is split at the centre line, so
the cut-stone shading has something to work with. Four facets in total.

### The mark: one aqua ramp

Four steps at hue 207, from a near-white rim down to a near-black shadow.

| Step | From | To |
|---|---|---|
| `arena-rim` | `#cdf8fe` | `#60ebfc` |
| `arena-lit` | `#2cd1e4` | `#25b5c6` |
| `arena-body` | `#198d9a` | `#106d77` |
| `arena-shadow` | `#07545d` | `#00383e` |

The lit step sits at the accent's own lightness, so the mark and `--primary`
read as the same colour rather than as two neighbours. The rim is deliberately
desaturated: a stone reads as cut only if something on it catches light like
metal.

### The product accent: the mark's own aqua

`--primary` is **`oklch(0.74 0.125 207)`** (`#11c0d3`), the mark's aqua.

**Every accent in the app sits at L 0.74** — the brand aqua, the counter-accent,
gain, loss, warning and destructive alike. They used to run from 0.63 to 0.79,
a visible sixth of the lightness range, and it showed: the brand shouted over
the semantics and the loss red sank into the field. One lightness means a
green, a red and the brand carry the same weight and differ only in hue, which
is the job hue is supposed to do. Chroma is set per hue to just inside the sRGB
gamut, because the reds and the cyan reach their limits at different points.

It is an accessibility gain too: loss went from 5.74:1 on black to 8.8:1.

Everything derives from this one token via `oklch(from var(--primary) ...)`, so
there is exactly one value to change in `src/app/globals.css`.

`--cat-1` and `--cat-6` moved from hue 195 to 182 when this landed. `--chart-1`
is `--primary`, and at 195 those two categories sat 12 degrees off the accent,
close enough that a chart could have drawn the brand and a category in near
enough the same colour. Every categorical hue now clears every semantic hue by
at least 18 degrees.

### The counter-accent

`--glow-secondary` is **`oklch(0.68 0.16 328)`** (`#d466d2`), a magenta. It
lights the far lobe of the ambient field so the page is lit from two directions
in two hues rather than one colour twice.

It was chosen rather than picked. The true complement of the accent is hue 27,
a coral, which would give the most chromatic contrast and is unusable here: it
lands 5 degrees from `--destructive` and 11 from `--loss`, and in a money game
an ambient coral wash reads as "you are down" before it reads as decoration.
Yellow is Lab's and Arena should not borrow it. That leaves the violet to
magenta band, where 328 sits 121 degrees off the accent, still far enough to
read as an opposite, while clearing every semantic hue by at least 44 degrees.

It is deliberately quiet: 18 percent on desktop, 13 percent on a phone. It
should be felt rather than noticed.

### What did not change

`--gain`, `--loss`, `--warning` and `--destructive` are untouched. They are
semantic and never decorative. The categorical `--cat-*` family is untouched.
The field is still true black and the theme colour is still `#000000`.

---

## Regenerating the assets

Geometry lives in two places that must stay in step: `src/lib/brand/mark.ts`
for everything the app renders, and `scripts/generate-icons.mjs` for the
rasters.

`ArenaMark.tsx` draws from `mark.ts` rather than holding its own copy, because
the weekly share card has to draw the same stone into a PNG through a
different renderer. Two copies of the geometry would drift, and a logo that
differs between the app and the thing people post is worse than either.

After changing either place:

```
npm run icons
```

That writes:

| File | Use |
|---|---|
| `public/arena-mark.svg` | Source mark, transparent |
| `public/favicon.png` | 32px favicon |
| `public/icons/icon-{16,32,48,180,192,512}.png` | Favicons, apple-touch, PWA `any` |
| `public/icons/maskable-{192,512}.png` | PWA `maskable`, black plate, mark at 0.62 so Android's circular crop never clips a facet |
| `public/og.png` | Social card, 1200x630 |

The social card is product chrome, so its ambient glow follows `--primary` and
is amber while the mark stays aqua. Its headline is set on two lines: the card
is rasterised with whatever sans the build host has rather than Geist, and one
long line overflowed 1200px under the fallback metrics.

---

## How it was chosen

Five rounds, all in the branch history of the pull requests that introduced and
then replaced the first mark.

1. Ten silhouettes in Lab's gold. All rejected. Every motif was a stock victory
   symbol, and one shared palette made ten ideas look like one.
2. Ten in a jewel palette, each about a relationship between two parts. Field
   and Split survived, both systematic rather than symbolic.
3. Ten developed from those. Quorum and Cleave survived.
4. Ten in teal working that family as one. Cleave in aqua shipped.
5. Cleave was then rejected in use: correct in isolation, unremarkable in the
   header. Rift replaced it, keeping the construction and the aqua and throwing
   out the silhouette.

The lesson worth keeping is from round five rather than round one. A mark that
reviews well as a specimen can still fail in the lockup, so judge the next one
in the header at 20px and on the landing page at hero size before deciding.

The exploration is kept in `docs/brand/concepts/`, generated by
`scripts/logo-concepts.mjs`. It is a record, not a dependency: nothing in the
app imports from it.
