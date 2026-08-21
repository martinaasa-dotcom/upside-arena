# The Arena mark

Arena's mark is a single eight-sided stone, parted along its diagonal, cut
from aqua. It is called Cleave. It ships in `src/components/brand/ArenaMark.tsx`.

This document records what was decided and why, so the next person does not
have to reconstruct it from the branch history.

---

## What it is

An octagon of radius 26 about (32, 32) on the 64 grid, rotated 22.5 degrees so
the stone sits flat, then parted along the diagonal from vertex 5 to vertex 1
by 1.5 units in each direction. Four facets: a lit rim and a lit face on the
upper half, a body and a shadow on the lower half, so the lit half reads as
being in front and the shadowed half as falling away behind the cut.

The parting is the whole idea. One stone, cleanly split, rather than two
shapes arranged next to each other.

### Construction, shared with Lab

This part is deliberately identical to Lab's mark, and must stay that way:

- flat facets, no strokes, transparent ground
- the 64 grid
- each facet drawn full-size then scaled `0.93` toward its own centroid, which
  is what produces the even hairline cuts

Only the silhouette and the metal differ. Lab is a solid standing "A" in warm
gold; Arena is a parted stone in aqua. Siblings, not twins.

### The gap

`1.5`. This was chosen by generating the mark at 0.75, 1.5, 2.25 and 3 and
comparing them. At 3 the halves stop reading as one parted stone and start
reading as two stones side by side. At 0.75 the cut nearly closes and takes
the sense of depth with it.

---

## Colour

### The mark: aqua

| Step | From | To | Role |
|---|---|---|---|
| `arena-rim` | `#d9f7ff` | `#a6e4f2` | Polished rim, catches the light |
| `arena-lit` | `#4fd0e0` | `#2a9fb5` | Lit face, carries the stone |
| `arena-body` | `#17879c` | `#0d6070` | Body, past the cut |
| `arena-shadow` | `#0b4a58` | `#052e36` | Shadow, falling away |

The rim step is deliberately desaturated. A jewel only reads as cut stone if
something on it catches light like metal.

The shadow step is close to the true-black field on purpose. It was checked at
16px magnified: the silhouette still holds, so it was left dark rather than
lifted.

### The product accent: the mark's own aqua

`--primary` is **`oklch(0.79 0.113 207)`** (`#4ad0dd`), which is the mark's lit
face rounded. The chrome and the logo are literally the same colour rather than
two colours chosen to sit near each other. Black on it clears 10.7:1, so
`--primary-foreground` stays near-black.

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

Four rounds, all in the branch history of the pull request that introduced this
mark.

1. Ten silhouettes in Lab's gold. All rejected. Every motif was a stock victory
   symbol, and one shared palette made ten ideas look like one.
2. Ten in a jewel palette, each about a relationship between two parts. Two
   survived: Field, a grid with one stone lit, and Split, one solid cut and
   offset. Both systematic rather than symbolic.
3. Ten developed from those. Two survived: Quorum, a honeycomb, and Cleave.
4. Ten in teal working that family as one, with Cleave's gap tightened.
   Cleave in aqua was picked.

The exploration is kept in `docs/brand/concepts/`, generated by
`scripts/logo-concepts.mjs`. It is a record, not a dependency: nothing in the
app imports from it.
