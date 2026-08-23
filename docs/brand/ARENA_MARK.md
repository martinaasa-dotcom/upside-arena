# The Arena mark

Arena's mark is two heavy peaks in aqua, a near one and a far one, parted by a
hairline. It is called **Rally**. It ships in
`src/components/brand/ArenaMark.tsx`, drawn from `src/lib/brand/mark.ts`.

This document records what was decided and why, so the next person does not
have to reconstruct it from the branch history.

---

## What it is

Two heavy peaks sharing one baseline. The near one is taller, sits left, takes
the light, and has a single counter cut through it. The far one is shorter,
sits right, is two steps darker, and is **solid**. A hairline parts them.

The pair is the whole idea. Arena is a game you play against people you know,
one week at a time, and a week in it looks exactly like this: somebody ahead,
somebody just behind, both climbing. A single object could say *upside*; only
a pair can say *upside against somebody*.

It is also what separates Arena from Lab without a colour swatch doing all the
work. **Lab draws one peak. Arena draws two.** One product is your own
portfolio, where there is nobody else. The other is the game.

### Two things it had to learn

**It has to occupy its icon.** The first version drew the same two peaks with
legs half this width, and it was correct as a drawing and wrong as a mark: on
a home screen it read as two thin strokes floating in the middle of a tile,
like a logo somebody had forgotten to finish. The legs are 16 units either
side of a 46-unit span now, so the mass is most of the drawing and the counter
is a slot through it rather than the shape itself.

**One aperture is enough.** The far peak had a counter too, and the middle of
the mark was four edges deep — the near peak's slot, the far peak's slot, and
the hairline between them. At any size below a poster that reads as clutter
rather than as depth. Solid is what makes the far peak unmistakably the one
behind, and it is the only difference between the two shapes that does not
need a second glance.

### Construction, shared with Lab

What the two marks share, and must go on sharing:

- flat fills, no strokes, no bevel, no baked shadow
- a light ramp that runs across the whole drawing rather than per shape
- hairline cuts between the masses, resolved optically as the drawing shrinks
- the same icon plate, the same four-preset safe-area system, and the same
  refusal to bake a corner radius into anything the system will mask

Everything else differs, and deliberately. Lab is one standing "A" in warm
gold, cut into **ten** facets, and the hairlines there *close* as it shrinks
(`facetScale`). Arena is **two** peaks in aqua and its one hairline *widens*
(`cutForSize`). Both rules exist for the same reason — a cut has to survive as
roughly a pixel on screen — and they point in opposite directions because one
drawing has nine cuts to lose and the other has one to keep. Siblings, not
twins.

### Geometry

Both peaks are the same construction, in `peakPath()`: an apex and two feet on
a shared baseline at `y = 60`. A peak with a `leg` gets a counter cut through
it, sized by that leg width measured horizontally at the foot; a peak without
one is a plain triangle.

| | Apex | Half-span | Leg | Fill |
|---|---|---|---|---|
| Near | `(24, 4)` | 23 | 16 | `arena-near` |
| Far | `(44, 16)` | 19 | — solid | `arena-far` |

The drawing spans x 1–63 and y 4–60: 62 by 56 in a 64 grid, centred exactly on
(32, 32). It fills its own box, which is why `MARK_ZOOM` is 1 — it was 1.1
back when the peaks were thin enough to look lost in a browser tab. Making the
mark heavier is what removed the need for the lift.

`INNER_APEX` is `0.62`. At `1` the notch between a peak's legs falls exactly
where two lines parallel to the outer edges would meet, the legs are a
constant horizontal width, and the peak reads blunt — a tent. Below `1` the
inner apex rides up, the legs thin toward the top, and it reads as a peak.
`0.62` is as far as it goes before the two legs stop looking like one object.

### The cut follows the size, and it runs backwards

`cutForSize()` in `src/lib/brand/mark.ts` decides how wide to cut the hairline
between the peaks, and every drawing of the mark uses it: the React component
from its `size` prop, the standalone SVG from its requested size, and each
raster from the size it is about to be written at.

```
cut = clamp(70 / size, 1.6, 4)
```

| Drawn at | Cut, in grid units | On screen |
|---|---|---|
| 512px | 1.6 (floor) | ~13px |
| 180px | 1.6 (floor) | ~4.5px |
| 44px | 1.6 | ~1.1px |
| 32px | 2.2 | ~1.1px |
| 16px | 4.0 (ceiling) | ~1px |

It gets **wider** in grid units as the drawing gets smaller, which is the
opposite of the instinct. What has to survive is roughly a pixel on screen,
not a number in the grid. At 16px a poster-sized 1.6-unit hairline is a fifth
of a pixel, anti-aliasing eats it, and the two peaks fuse into one blob with a
smudge down the middle — which is precisely how a mark stops reading as two
things, and the failure the previous mark hit at favicon size.

The floor keeps the seam a deliberate hairline at poster sizes rather than
letting it vanish; the ceiling stops it opening into a canyon on a favicon.

The cut is a **mask**, not a painted gap. The far peak is drawn through a mask
that knocks out the near peak plus a `cut`-wide halo. Filling the gap with the
plate colour instead would work on the icons and fail everywhere else: the
bare mark is transparent and the plate is a gradient, so there is no one
colour to fill with. A mask cuts the same seam on black, on white, and on
nothing at all.

### The mark: one aqua ramp, split across the pair

| Step | From | To | oklch |
|---|---|---|---|
| `arena-near` | `#d0fbff` | `#1ec8d0` | L 0.96 → 0.76 |
| `arena-far` | `#00a6b4` | `#00616f` | L 0.66 → 0.45 |

The near peak's lower stop sits at the accent's own lightness, so the mark and
`--primary` read as the same colour rather than as two neighbours. The far
peak runs two steps below it — far enough to sit back on the true-black field
without disappearing into it.

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

`--glow-secondary` is **`oklch(0.74 0.17 328)`** (`#e380e0`), a magenta. It
lights the far lobe of the ambient field so the page is lit from two directions
in two hues rather than one colour twice. Like every other accent it sits at
L 0.74.

It was chosen rather than picked. The true complement of the accent is hue 27,
a coral, which would give the most chromatic contrast and is unusable here: it
lands 5 degrees from `--destructive` and 11 from `--loss`, and in a money game
an ambient coral wash reads as "you are down" before it reads as decoration.
Yellow is Lab's and Arena should not borrow it. That leaves the violet to
magenta band, where 328 sits 121 degrees off the accent, still far enough to
read as an opposite, while clearing every semantic hue by at least 44 degrees.

It is deliberately quiet: 18 percent on desktop, 13 percent on a phone. It
should be felt rather than noticed.

---

## The app icon

The mark is not the icon. The icon is the mark on a plate, and the plate is
where the Apple rules live.

`PLATE` and `ICON_PRESETS` in `src/lib/brand/mark.ts` hold both.

### The plate

Full-bleed, opaque, and lit from the same two directions the app itself is:
the near lobe in the accent aqua at the top left, the far one in the magenta
counter-accent at the bottom right, over a field that runs `#10353d` to
`#010a0c`. An icon lit like the product is what makes the home screen and the
app feel like one thing rather than two.

The field is a deep teal rather than the app's true black, and that followed
from the mark getting heavier. Once the peaks fill most of the tile the ground
is a setting rather than a stage: near-black behind them read as a hole with a
logo in it, where a deep teal reads as air. Arena is a game, and it is allowed
to have some colour in it — this is the one place the product's chrome rule
(true black, everywhere) deliberately does not reach.

What it deliberately does **not** carry:

- **no baked corner radius** on the square shapes. iOS, iPadOS and macOS draw
  their own squircle over whatever they are given. An icon that arrives
  already rounded gets rounded twice, and the visible tell is a thin dark
  crescent inside each corner. The previous Lab icon had exactly this.
- **no baked drop shadow and no baked specular highlight.** The system adds
  its own lighting, and a second one underneath it reads as dirt.
- **no alpha channel** on the square shapes. Apple rejects an App Store icon
  with transparency, and iOS composites a transparent touch icon onto black
  anyway — which is not a decision anybody made, it is just what happens.
- **no text.** Nothing survives 16px.

### The presets

| Preset | Corner | Mark scale | Where it goes |
|---|---|---|---|
| `app` | square | 0.80 | Apple touch icon, App Store master |
| `tile` | 22.5% | 0.88 | favicons, bookmark tiles, PWA `any` |
| `maskable` | square | 0.56 | Android adaptive icons |
| `consent` | 22.5% | 0.60 | Google's OAuth dialogue |

Each of them crops differently, which is why one safe area would be wrong for
all of them.

`app` is square and full-bleed because the system masks it, and `0.80` puts
the mark inside the concentric safe area Apple's icon grid reserves — room for
the mask to take the corners without touching a foot.

`tile` carries its own rounded shape because nothing masks a favicon, and the
mark sits larger for the same reason.

`maskable` is pulled well inside Android's 80-percent circle rather than to
its edge, because some launchers crop closer to a squircle than to a circle.

`consent` is its own shape of problem: 120px, on a surface whose colour we do
not control, cropped to a circle in some of Google's dialogues and left square
in others. So it keeps a plate and a rounded shape, and sits inside the circle
— which is what pulled it from 0.66 to 0.60 when the mark grew: the drawing's
diagonal, not its width, is what has to fit a circular crop.

### The optical lift

The plated icons sit the mark 2.5 percent above the geometric centre of the
plate. A pair of peaks is a triangular mass: nearly all of its area is along
the baseline and the apexes are points, so its perceived centre is well below
the middle of its bounding box, and centred by the numbers it reads as having
sagged.

It applies to the plated icons only. The bare mark is placed by whatever is
around it — a flex row in the lockup, a host's own tile padding — and a
drawing that is secretly off-centre would fight all of them.

---

## Regenerating the assets

Geometry lives in **one** place, `src/lib/brand/mark.ts`.
`scripts/generate-icons.mjs` imports it directly — Node strips the types on
import — rather than holding the second copy it used to hold. The old copy
came with a comment asking the next person to keep the two in step, which is
another way of saying the app and its own favicon were one edit away from
being different logos at all times.

After changing it:

```
npm run icons
```

That writes:

| File | Use |
|---|---|
| `public/arena-mark.svg` | The bare mark, transparent |
| `public/favicon.png` | 32px favicon |
| `public/favicon.ico` | 16 + 32, for browsers that ask by habit |
| `public/icons/icon-{16,32,48,192,512}.png` | Favicons, bookmark tiles, PWA `any` |
| `public/icons/icon-180.png` | Apple touch icon: square, opaque, full-bleed |
| `public/icons/icon-1024.png` | App Store master |
| `public/icons/maskable-{192,512}.png` | PWA `maskable` |
| `public/icons/consent-120.png` | Google's OAuth dialogue |
| `public/og.png` | Social card, 1200x630 |

Every raster is supersampled — four times over below 256px, twice above — and
scaled back down, which is what keeps the long diagonals of the peaks from
stairstepping at favicon sizes.

The social card is product chrome rather than the mark, so it is composed in
the script. Its headline is set on two lines: the card is rasterised with
whatever sans the build host has rather than with Geist, and one long line
overflowed 1200px under the fallback metrics.

Bump the `?v=` on the icon entries in `src/app/layout.tsx` whenever the
drawing changes. A favicon is one of the few things a browser holds past a
deploy, and a stale one outlives the rebrand that replaced it.

---

## How it was chosen

Six rounds. The first five are in the branch history of the pull requests that
introduced, then replaced, the first mark.

1. Ten silhouettes in Lab's gold. All rejected. Every motif was a stock
   victory symbol, and one shared palette made ten ideas look like one.
2. Ten in a jewel palette, each about a relationship between two parts. Field
   and Split survived, both systematic rather than symbolic.
3. Ten developed from those. Quorum and Cleave survived.
4. Ten in teal working that family as one. Cleave in aqua shipped.
5. Cleave was rejected in use: correct in isolation, unremarkable in the
   header. **Rift** replaced it — one six-sided stone with a chevron channel
   cut through — keeping the construction and the aqua.
6. Rift was rejected in turn, on two counts. It read as one object broken
   rather than as anything anybody wanted; and its bevelled cut-stone
   treatment was a decade-old idiom. Rally replaced it: no bevel, two solid
   masses, and a plate built to Apple's current icon rules rather than to a
   favicon exporter's defaults.
7. Rally shipped thin and was sent back the same day. The direction was right
   and the drawing did not carry its tile — two small strokes with most of the
   icon empty around them. The legs roughly doubled, the far peak lost its
   counter, the field came up to a deep teal, and the whole thing got an
   optical lift. Same mark, finally the right weight.

Two lessons worth keeping. From round five: a mark that reviews well as a
specimen can still fail in the lockup, so judge the next one in the header at
20px and on the landing page at hero size before deciding — and, since round
six, at 16px on a plate as well. From round seven: judge it as an app icon at
full size too, on a home screen among other icons, because "does this drawing
own its tile" is a question a contact sheet of marks never asks.

The earlier exploration is kept in `docs/brand/concepts/`. It is a record, not
a dependency: nothing in the app imports from it.
