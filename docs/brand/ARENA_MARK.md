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

### Beside the words

`ArenaWordmark` sets the mark against **UPSIDE ARENA** in a flex row. Every
part of it is a ratio of one unit (`size`), so the lockup scales as one
object: `LOCKUP` in `src/lib/brand/mark.ts` holds the three.

| | Ratio | At the header's unit of 20 |
|---|---|---|
| Type | 0.7 | 14px, which is what the header has always set |
| Mark's box | 1.12 | 22.4px, so the ink stands 19.6px |
| Gap | 0.5 | 10px |

**The unit is not the mark's box.** It was, and the drawing's ink is 56 of its
64 units tall, so the mark stood 0.875 of the type size while Lab's "A" stands
a clean 1.4. Beside each other, Arena's lockup read as the smaller of two
siblings rather than as the same one in another colour. At 1.12 the ink is 1.4
times the type exactly, so the two apps put the same amount of drawing beside
the same amount of word.

Matching Lab's *width* instead would take 1.43 and it is the wrong invariant:
Lab draws one wide "A" (aspect 1.24) and Arena two upright peaks (1.11), so
equal widths would leave Arena towering over the caps. A line of type is
measured by height.

The gap went 0.4 to 0.5 with it, which is the 10px Lab sets against 14px type.
The mark's ink runs to within a unit of its box on both sides, so what is set
here is the whole of the gap on screen.

The row centres two boxes; the eye centres two masses, and for this drawing
those are not the same place.

Two peaks are nearly all base. The apexes are points and almost every square
unit of the drawing sits along the baseline, so the ink's centre of area lands
at **y = 40.8** on the 64 grid — 8.8 units below the middle of the box it is
centred in. Box-centred beside a word, the mark reads as having sagged: its
feet hang well under the baseline while the apex barely clears the caps.

`LOCKUP_LIFT` lifts it by **half** that offset: 4.4 units, 6.9 percent of the
drawn size, so about 1.5px at the header's 22.4px mark and 3.4px at the
landing page's 49px one. Half rather than all of it because the perceived
centre of a triangular mass sits between the outline's middle and the balance
point;
lifting the centre of area itself onto the cap band puts the apex a long way
over the caps with the feet on the line, and the mark stops looking as though
it is standing on anything. 0, 3, 4.4, 6 and 8.8 units were rendered against
the real type at both sizes before the number was picked.

Nothing else is needed on the row. Geist's caps are centred in a
`leading-none` line box to within a twentieth of a pixel at 14px, measured, so
`items-center` already lines the two boxes up and the lift is the only
correction.

It is a `transform`, so the lockup's own box does not move and nothing around
it reflows, and it applies **only when there is type**: `markOnly` gets the
drawing centred in its box, because a mark that is secretly off-centre fights
every other place it is put. The share card's lockup
(`app/w/[token]/opengraph-image.tsx`) takes the same lift from the same
constant. `tests/unit/lockup.test.ts` recomputes the balance point from the
outlines, so a peak cannot move without the constant following.

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

### Two colourways

The mark has two, and which one is right depends entirely on what it is
sitting on. `COLOURWAYS` in `src/lib/brand/mark.ts`.

**`MARK`** is the app's: aqua on the app's own true black, transparent. The
header lockup, the share card, `public/arena-mark.svg`.

| Ramp | From | To | oklch |
|---|---|---|---|
| near | `#d0fbff` | `#1ec8d0` | L 0.96 → 0.76 |
| far | `#00a6b4` | `#00616f` | L 0.66 → 0.45 |

The near peak's lower stop sits at the accent's own lightness, so the mark and
`--primary` read as the same colour rather than as two neighbours.

**`ICON`** is the home screen's, and it is the reverse: the accent aqua as the
*field*, with the peaks in an ink drawn from the same hue.

| | From | To |
|---|---|---|
| plate | `#86eef7` | `#0a7f96` |
| near | `#032128` | `#021216` |
| far | `#083a45` | `#04222a` |

**Depth reverses with it.** On black the near peak is the brightest thing and
the far one recedes into the field. On aqua the near peak is the *darkest* and
the far one is closer to the plate. Contrast is what says "in front", and it
points the other way round on a light ground.

Why the icon is not simply the app: see the plate below.

### The product accent: the mark's own aqua

`--primary` is **`oklch(0.74 0.125 207)`** (`#11c0d3`), the mark's aqua.

**The brand aqua, the counter-accent, gain and warning sit at L 0.74.** They
used to run from 0.63 to 0.79, a visible sixth of the lightness range, and it
showed: the brand shouted over the semantics and the loss red sank into the
field. One lightness means a green, an amber and the brand carry the same
weight and differ only in hue, which is the job hue is supposed to do. Chroma
is set per hue to just inside the sRGB gamut, because each hue reaches its
limit at a different point.

**The reds are the exception, and sRGB is the reason.** Red is the one hue
where the lightness a palette picks decides whether the colour exists at all.
At L 0.74 the most chromatic red in gamut is `oklch(0.74 0.16 25)`, `#ff716b`,
which is a salmon: not a red held quietly, a different colour, and the one
thing a losing number must not read as. Chroma comes back with every step
down, so both reds drop to where a red is available and hold hue 25, a degree
off pure red's 29 and 20 clear of the amber at 45.

They land at two lightnesses, because they do two jobs.

| Token | Value | sRGB | Measured |
| --- | --- | --- | --- |
| `--loss` | `oklch(0.66 0.22 25)` | `#fc4447` | 6.1:1 on black |
| `--destructive` | `oklch(0.58 0.232 25)` | `#e30a28` | white on it 4.8:1 |

`--loss` is text on the field, set at the lightest point that is still
unmistakably red. 6.1:1 is short of the 8.5:1 the salmon measured and well
past the 4.5:1 AA asks of body text, and a number nobody reads as a loss is
the worse failure of the two.

`--destructive` is a fill under white text, so it is measured the other way
round: at L 0.74 white on it was **2.46:1**, a real failure that was shipping,
and at L 0.58 it is 4.83:1 and passes. As the invalid input's border it
measures 4.3:1 on black, clear of the 3:1 non-text bar.

Do not raise either back to 0.74 for the sake of the row. A palette rule that
turns the loss colour into a salmon has stopped describing the product.

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
lands 2 degrees from `--loss` and `--destructive` both, and in a money game
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

One linear gradient, top to bottom, full-bleed and opaque. Nothing else.

It used to be the app's own ambient lighting — a radial field with an aqua
lobe behind the mark and a magenta counter-lobe in the far corner — moved onto
a 64px tile, where all it did was read as a smudge. An icon plate is a flat
colour with a gentle fall, the way every icon it will sit beside is.

**And the field is the accent, not the app's black.** This is the correction
that mattered most, and it only showed up when the icons were put in a grid
next to the ones people actually have. A near-black tile among them does not
read as premium and restrained; it reads as a hole where an app should be.
Arena's chrome is true black and stays true black — the icon is the one place
that rule deliberately does not reach, because an icon is not chrome, it is a
thing on somebody's home screen competing with forty others.

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
| `app` | square | 0.66 | Apple touch icon, App Store master |
| `tile` | 22.5% | 0.70 | bookmark tiles, PWA `any` |
| `favicon` | 22.5% | 0.80 | the 16, 32 and 48 favicons |
| `maskable` | square | 0.52 | Android adaptive icons |
| `consent` | 22.5% | 0.54 | Google's OAuth dialogue |

The number is the fraction of the tile the mark's **width** takes, not a raw
scale factor — a scale says nothing about how close a foot lands to an edge.

Each of them crops differently, which is why one safe area would be wrong for
all of them.

**0.66 is the register, not a compromise.** A centred symbol on an Apple icon
runs between about half and two thirds of the tile — Music's note is near
0.48, Messages' bubble near 0.64, Mail's envelope near 0.66 — and the margin
around it is doing as much work as the symbol. This was 0.80 for one round
because bigger sounded better; in a grid beside real icons it read as crowded
rather than as confident.

`tile` carries its own rounded shape because nothing masks it, and the mark
sits larger for the same reason.

`favicon` is `tile` with more of the plate given to the mark, and it exists
because a favicon is the one place the icon is smaller than the thing it has
to say. At 16px the plate is sixteen pixels and the mark inside it is eleven;
every one of them has to carry meaning, and the margin that makes a
home-screen icon look composed is just wasted room.

`maskable` is pulled well inside Android's 80-percent circle rather than to
its edge, because some launchers crop closer to a squircle than to a circle.

`consent` is its own shape of problem: 120px, on a surface whose colour we do
not control, cropped to a circle in some of Google's dialogues and left square
in others. So it keeps a plate and a rounded shape, and sits inside the circle
— which is what pulled it from 0.66 to 0.60 when the mark grew: the drawing's
diagonal, not its width, is what has to fit a circular crop.

### The optical lift

The plated icons sit the mark 2 percent (`OPTICAL_LIFT`) above the geometric
centre of the plate, for the reason set out in *Beside the words*: the mass is
triangular, so the perceived centre is below the middle of the bounding box
and centring by the numbers reads as a sag.

It is smaller than the lockup's 6.9 percent because a tile is not a line of
type. The lockup answers to a cap band a few pixels tall; a plate is a square
with generous margin on every side, where the same correction would read as
the drawing having drifted up.

Both live outside the mark. The drawing itself stays centred in its own box,
because it is placed by whatever is around it — a flex row in the lockup, a
plate, a host's own tile padding — and a drawing that is secretly off-centre
would fight all of them.

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
| `public/favicon.svg` | Scalable favicon |
| `public/favicon.png` | 32px favicon |
| `public/favicon.ico` | 16 + 32, for browsers that ask by habit |
| `public/icons/icon-{16,32,48}.png` | Favicons |
| `public/icons/icon-{192,512}.png` | Bookmark tiles, PWA `any` |
| `public/icons/icon-180.png`, `public/apple-touch-icon.png` | Apple touch icon: square, opaque, full-bleed |
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
   counter, and the whole thing got an optical lift.
8. Then the weight overshot, to 0.80 of the tile, and the plate was still
   near-black. Both were fixed by the same test: render the icons in a grid
   beside the ones people actually have. At 0.80 the mark read as crowded; on
   near-black the tile read as a hole. Coverage came back to the Apple
   register and the accent moved from the mark to the field. The drawing has
   not changed since round seven — only what it sits on and how much room it
   is given.

Three lessons worth keeping. From round five: a mark that reviews well as a
specimen can still fail in the lockup, so judge the next one in the header at
20px and on the landing page at hero size before deciding — and, since round
six, at 16px on a plate as well. From round seven: judge it as an app icon at
full size too, because "does this drawing own its tile" is a question a
contact sheet of marks never asks. From round eight, the one that actually
found the errors: **judge it in a grid beside icons you did not make.** A
contact sheet of your own variants tells you which of them is best. Only a
home screen tells you whether any of them belongs there.

The earlier exploration is kept in `docs/brand/concepts/`. It is a record, not
a dependency: nothing in the app imports from it.
