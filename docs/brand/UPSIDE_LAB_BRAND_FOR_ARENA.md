# Upside Lab visual system (for Upside Arena)

> **Superseded in part.** This records Lab's system as of the capture date and
> the constraint Arena started from. Arena has since diverged by explicit
> decision, and `docs/brand/ARENA_MARK.md` wins wherever the two disagree:
>
> - The mark is a parted aqua stone, not a gold "A".
> - `--primary` is that same aqua, `oklch(0.74 0.125 207)` (`#11c0d3`). Arena's
>   accent is not a warm yellow, and the "do not guess" note below applies to
>   Lab only.
> - A second brand colour exists: `--glow-secondary`, a magenta, lighting the
>   far lobe of the ambient field. The "one accent only" rule below is Lab's.
> - The magenta ban in section 3 is Lab's and does not bind Arena. It still
>   holds for anything semantic: hues near `--loss`, `--destructive`,
>   `--warning` and `--gain` stay reserved, which is why the counter-accent is
>   not the coral that colour theory would otherwise point at.
> - The glass is heavier than section 6 describes. Arena now runs
>   `blur(40px) saturate(1.9)` with a 66 percent transparent fill, matching
>   Lab's current source rather than the values captured here, and the header
>   is a glass bar rather than an opaque one.
>
> Everything else here still holds.

Live product: https://upsidelab.app
Captured: 2026-08-20 audit screenshots under `audit-final/`. Tokens below are from live source (`src/app/globals.css`, `DESIGN_TOKENS.md`).

**Refreshed 2026-08-21 (evening).** Lab shipped four rounds of design work that
day and this document was written before them, so five of its sections were
describing a system that no longer existed. What moved: a second ambient hue
(§3, §6), Archivo on headings and the wordmark (§4), a mono-caps label voice
(§4), the whole glass and chrome recipe (§5, §6), and the removal of the
blanket violet ban (§3). Each is marked **New 2026-08-21** below. Everything
not so marked was already true and still is.

Arena should share this brand shell and diverge only in execution (rooms,
interaction, game-like surfaces), not in palette, type, or chrome — with the
divergences `ARENA_MARK.md` already records.

Do not invent a second dark theme. Do not guess gold/violet/near-white for
`--primary`. Lab's accent is a quiet warm yellow.

---

## 1. Verdict for Section 4

Lab is worth anchoring to. Fold these tokens into the Arena plan as the shared shell. Treat brand alignment as the starting constraint, not a fast-follow.

What Arena may change: information architecture, density of game/competition UI, unique rooms, motion that Lab does not have.

What Arena must not change: field, card, border, radius, type, accent, gain/loss/warning semantics, glass treatment, wordmark pattern, 24-hour clock, sentence case.

---

## 2. Screenshots to attach

All under the Lab repo. Desktop first; mobile twins exist with the same names (`-ios`, `-android`).

| File | What it shows |
|---|---|
| `audit-final/signin-desktop.png` | Signed-out landing. Split layout, gold CTA, sample book card, ambient glow. |
| `audit-final/landing-desktop.png` | Same landing, full frame. |
| `audit-final/overview-desktop.png` | Signed-in Overview. Score cards, movers, Worth noticing, bottom dock. |
| `audit-final/lab-desktop.png` | Lab tab. Allocation score, theme bar, sub-tabs (Allocation / Risk / Trends / Seasonality). |
| `audit-final/pulse-desktop.png` | Pulse. Search card, today's scan list, thesis badges. |
| `audit-final/forecast-desktop.png` | Forecast / Compound path (same shell). |
| `audit-final/circle-desktop.png` | Circle (communities). Same chrome. |
| `audit-final/header-closeup-ios.png` | Header lockup close-up. |
| `audit-final/cta-closeup-desktop.png` | Primary button close-up. |
| `audit-final/movers-closeup-desktop.png` | Gain/loss mover cards. |
| `public/upside-mark.png` | Logo mark: ten-facet metallic gold A. Not CSS-token-driven. Keep as-is. |
| `public/og.png` | Open Graph / social image. |

---

## 3. Color tokens (source of truth)

Dark only. `html { color-scheme: dark }`. Theme color `#000000`.

Use oklch in CSS. Hex is the sRGB conversion for places that cannot do oklch (email, Figma, some docs).

### Surfaces

| Token | oklch | Hex | Use |
|---|---|---|---|
| `--background` | `oklch(0 0 0)` | `#000000` | Page field. True black. |
| `--card` / `--popover` / `--sidebar` | `oklch(0.205 0 0)` | `#171717` | Card step (shadcn dark default). Never paint this opaque on a top-level panel; see glass. |
| `--muted` / `--secondary` / `--accent` | `oklch(0.269 0 0)` | `#262626` | Nested wells, hover, secondary fill. |
| `--border` / `--sidebar-border` | `oklch(1 0 0 / 16%)` | white @ 16% | Hairline, not a filled grey. |
| `--input` | `oklch(1 0 0 / 18%)` | white @ 18% | Input edge. |
| `--foreground` / `--card-foreground` | `oklch(0.985 0 0)` | `#fafafa` | Primary text. |
| `--muted-foreground` | `oklch(0.708 0 0)` | `#a1a1a1` | Labels, secondary copy. |
| `--primary-foreground` | `oklch(0.145 0 0)` | `#0a0a0a` | Text on the warm-yellow accent. |

### Brand accent (one only)

| Token | oklch | Hex | Use |
|---|---|---|---|
| `--primary` / `--ring` / `--sidebar-primary` | `oklch(0.8 0.09 90)` | `#d4bc79` | Buttons, focus rings, active nav, chart stroke, ambient glow. Quiet warm yellow, not bright gold and not the old violet. |

`--primary-foreground` is near-black because the accent is light.

Do not reintroduce Gold Delta (`oklch(0.762 0.102 80)`) or the Pass-1 violet
(`oklch(0.62 0.24 291)`) as `--primary`.

**New 2026-08-21.** The blanket ban on violet / purple / magenta (hue 270–330)
is lifted. It existed because `--primary` had once *been* a violet and the ban
stopped it creeping back; as a rule over the whole wheel it also blocked the
accent's own complement, which is where the ambient counter-lobe below wanted
to sit. Judge a hue on what it collides with, not on which arc it falls in.

### Ambient counter-lobe (`--ambient-cool`) — **New 2026-08-21**

| Token | oklch | Hex | Use |
|---|---|---|---|
| `--ambient-cool` | `oklch(0.72 0.13 250)` | `#60aaf3` | The ambient page glow's bottom-right lobe, and nothing else. |

Chrome-only. Deliberately **not** exported through `@theme inline`, so there is
no `bg-ambient-cool` utility to reach for on a component.

Why 250: it is 160° from `--primary`'s 90, which is nearly all the opponent
contrast available — blue and yellow are the two ends of one of the channels
colour is encoded on leaving the retina, so the pair is opposite in the visual
system rather than merely on a diagram. It also clears every hue the palette
has already spent: 88° from `--gain`, 205° from `--warning`, 234° from
`--loss`. That margin is the point. The first attempt was a teal at hue 200,
which sits 38° from the emerald that means "this went up" — the one collision
a money app cannot afford.

**If Arena picks its own cool hue, re-solve the lobe alpha rather than copying
Lab's.** sRGB's blue primary carries roughly a fourteenth of the luminance of
its green, so two hues at the same alpha are not the same brightness. Lab's
teal needed 25% and its blue needs 31% to land at the same measured corner.

### Semantic (never decorative)

| Token | oklch | Hex | Use |
|---|---|---|---|
| `--gain` / `--chart-2` | `oklch(0.696 0.17 162.48)` | `#00bc7d` | Gains only. |
| `--loss` | `oklch(0.645 0.21 16.439)` | `#f2435f` | Losses only. |
| `--destructive` | `oklch(0.704 0.191 22.216)` | ~`#ff6467` (clips slightly) | Destructive actions. |
| `--warning` / `--chart-3` | `oklch(0.63 0.22 45)` | ~`#ed4900` | Caution only (Pulse watch, jumpy-book tone). Not a second brand color. |

Status is a border accent or a Badge. Never a tinted card wash (`bg-emerald-950/20` and similar). Gain-green does not belong in ambient chrome.

### Categorical data only (`--cat-1` … `--cat-10`, `--cat-neutral`)

Low-chroma family for charts that must tell many categories apart (Lab allocation bar, Circle animal cards). Never for chrome, never for good/bad.

| Token | oklch | Hex |
|---|---|---|
| `--cat-1` | `oklch(0.78 0.1 195)` | `#5ecbcb` |
| `--cat-2` | `oklch(0.62 0.11 230)` | `#2a92bb` |
| `--cat-3` | `oklch(0.78 0.1 125)` | `#a9c37b` |
| `--cat-4` | `oklch(0.62 0.11 340)` | `#b26b9b` |
| `--cat-5` | `oklch(0.78 0.09 260)` | `#96b9f1` |
| `--cat-6` | `oklch(0.62 0.11 195)` | `#009a9b` |
| `--cat-7` | `oklch(0.78 0.1 340)` | `#e39ecc` |
| `--cat-8` | `oklch(0.62 0.1 125)` | `#78914b` |
| `--cat-9` | `oklch(0.78 0.09 230)` | `#78c2e6` |
| `--cat-10` | `oklch(0.62 0.11 260)` | `#5e86c8` |
| `--cat-neutral` | `oklch(0.62 0 0)` | `#868686` |

Every hue clears the four semantic hues (loss 16, warning 45, primary 90, gain 162) by ≥18°. None in 270–330.

### Email hex (mail clients, not the web app)

From `src/lib/email-letter.ts`. Keep in step if tokens move.

```
app #000000 · card #171717 · well #262626 · cream #fafafa
muted #a1a1a1 · gold #d4bc79 · gain #00bc7d
loss is still #ff2056 in email (older clipped value). Live web is #f2435f.
```

---

## 4. Type

**New 2026-08-21: two faces, split by job.** All three font tokens used to
point at Geist, which made `--font-heading` and `--font-logo` decorative — the
`font-heading` utility was on about twenty call sites and did nothing.

| Role | Token | Face |
|---|---|---|
| Every sentence | `--font-sans` | Geist (`next/font/google`) |
| Every figure: money, percents, share counts, tickers | `--font-mono` | Geist Mono, `tabular-nums` |
| Headings, panel titles, tickers in tables | `--font-heading` | **Archivo** |
| The wordmark | `--font-logo` | **Archivo** |

Archivo because `font-heading` lands anywhere from a 14px ticker cell to a 24px
hero; a face with display-only proportions falls apart at the small end.
Loaded through `next/font`, which registers it under its real family name and
generates `Archivo Fallback` with metric overrides, so the swap costs no layout
shift.

One trap worth inheriting: the `h1…h4` element rule named `--font-sans` while
every deliberate heading used the `font-heading` utility. With both tokens on
Geist nothing gave the mismatch away — they would have split into different
faces the moment they diverged. Point the element rule at `--font-heading`.

Weights: body 400, headings 600.

**Tracking is a scale, not a constant** (New 2026-08-21). It was a flat
`-0.025em` at every level. Letterfit is optical: the spacing that reads right
at 14px reads loose at 24px, because tracking is a fraction of the em and the
gaps grow with the type.

| | Tracking |
|---|---|
| `h1` | `-0.035em` |
| `h2` | `-0.028em` |
| `h3` / `h4` | `-0.02em` |

Plus `text-wrap: balance` on headings, so a two-line title does not leave one
orphan word on the second line.

### Label voice: mono caps, two tiers — **New 2026-08-21**

**Tier one, scaffolding.** `MicroLabel` and every table column header: mono,
uppercase, 11–12px, `tracking-[0.1em]`, `--muted-foreground`.

Labels were sentence-case sans at the same size and weight as the muted prose
beside them, so they read as another line of copy rather than as structure.
Column headers were worse — `text-foreground`, which made the header row the
loudest row in the table, the one row a reader never needs to look at twice.
Tracking is `0.1em` because caps set at a face's normal tracking close up;
letterfit is drawn for mixed case.

Muted rather than accent on purpose: this lands on eight-plus components
including four abreast in the dashboard figure row and every table header in
the app, and the accent on all of them would spend the one brand colour on
scaffolding.

**Tier two, annotation.** `NoteRows`, in `--primary`: a short label in the
gutter and the prose it introduces, a `7rem / 1fr` grid collapsing to one
column on a phone. This tier gets the accent because the label does real work —
telling one paragraph from another where a card stacks several that mean
different things. Refuse to render it as a list below two rows; one labelled
row is a label with nothing to distinguish itself from.

Scale:

- Page titles: `text-2xl font-semibold tracking-tight` (matches `h1` 1.5rem / 2rem)
- Card titles: `text-lg`
- Body / labels: `text-sm`
- Chart ticks, Badge, kbd: `text-xs`
- Scoreboard figures: `font-mono text-2xl font-bold tabular-nums`

Sentence case everywhere a person reads it. "Price path", not "Year-by-Year Target Roadmap".

24-hour clock only (`08:30`, never `8:30 AM`). `hourCycle: "h23"`, `hour: "2-digit"`.

Logo type: `UPSIDE` bold + ` LAB` regular, uppercase, `tracking-wide`, now
**Archivo** via `--font-logo`. Header size `text-[14px] leading-none`. For
Arena: same pattern, `Upside` + ` Arena`.

Mark: `/public/upside-mark.png` (ten-facet gold A). Favicon, OG, X avatar use the same raster. Do not recolor it in CSS.

---

## 5. Radius, space, density

| Token | Value |
|---|---|
| `--radius` | `0.625rem` (10px). `rounded-xl` on top-level panels. |
| sm / md / lg / xl | `0.6×` / `0.8×` / `1×` / `1.4×` of `--radius` |
| Page max | `1200px` |
| Page gutter | `px-6` |
| Panel pad | `p-6` |
| Stack gap | `gap-6` |
| Score cards | `gap-4` between cards, never a hairline bar of numbers |
| Controls | `h-8` / `rounded-lg`. Landing CTA only: `h-11 rounded-full`. |
| Header | `h-12` (3rem), inside one glass wrapper with the status strip **(New 2026-08-21)** |
| Status strip | `2.25rem`, second row of that same wrapper **(New 2026-08-21)** |
| Desktop chrome total | `5.25rem` (84px). Spacer and sticky offset must match: `h-21` / `lg:top-21` |
| Chrome glass | `bg-background/35 backdrop-blur-2xl` **(New 2026-08-21)** |
| Touch | coarse pointer / <1024px: buttons min 2.75rem. Desktop stays dense. |

Table rows: fixed `h-10`. Do not wrap a row to two lines.

---

## 6. Surfaces: field, glow, glass — **rewritten 2026-08-21**

Every signed-in page wraps in `.page-frame` (`src/lib/page-shell.ts`), **and so
does the sign-in page**. That last part was not true until 2026-08-21: sign-in
painted its own two `rounded-full bg-primary/20 blur-[130px]` circles, one of
them warm on the *right* where the field is meant to be cool. The effect was
that every pass improving the glow improved `.page-frame::before` and that one
screen silently stayed a generation behind. **Nothing hand-rolls ambient light.**

### The field

Two lobes: a warm `--primary` key light off the top-left, a cool
`--ambient-cool` counter-lobe off the bottom-right.

```css
.page-frame::before {                 /* position: fixed; inset: 0; z-index: -1 */
  background-image:
    radial-gradient(170vw 112vh at -8% -10%,
      oklch(from var(--primary) l c h / 28%)   0%,
      oklch(from var(--primary) l c h / 15%)   18%,
      oklch(from var(--primary) l c h / 7.5%)  34%,
      oklch(from var(--primary) l c h / 3.2%)  52%,
      oklch(from var(--primary) l c h / 1.4%)  72%,
      transparent 98%),
    radial-gradient(170vw 112vh at 108% 110%,
      oklch(from var(--ambient-cool) l c h / 31%)   0%,
      oklch(from var(--ambient-cool) l c h / 16.5%) 18%,
      oklch(from var(--ambient-cool) l c h / 8%)    34%,
      oklch(from var(--ambient-cool) l c h / 3.4%)  52%,
      oklch(from var(--ambient-cool) l c h / 1.5%)  72%,
      transparent 100%);
}
```

Four things are load-bearing, and each was learned by getting it wrong:

**Sized in `vw`/`vh`, never `px`.** At a fixed 1250×1000 the lobe was wider than
a phone, so both lights flooded the screen and stacked into horizontal bands. On
a 390×844 viewport the old key light left the *top-right* corner at 58/255 and
the page middle at 29/255: no black, no diagonal. Viewport units hold the same
proportion at every width.

**Anchored just off-screen** (`-8% -10%`, `108% 110%`), so the brightest point of
each lobe is outside the frame and only its falloff is visible. Anchored on the
corner, the hottest pixel is in frame and reads as a lamp rather than as spill.

**Five stops each, most of the distance spent in the very dim end.** A single
colour-to-transparent ramp has a visible edge — the lobe reads as a shape
sitting on the page rather than as light.

**Brightness and coverage are separate dials. Keep them separate.** Peak alpha
(28% / 31%) has not moved across four widenings; only the radii and the tail
did. Current numbers, measured at 1440×900:

| | Value |
|---|---|
| Lit field (≥ 4/255) | 96.6% |
| Corner peaks (warm / cool) | 42 / 54 |
| The two opposite corners | 4 / 5 |
| Page middle | 8.1 |

Almost the whole frame carries light, and it still reads as a dark room lit from
two corners because the middle sits at 8 against 42 and 54. **The failure mode is
alpha, not size**: one pass pushed 60%/34% and put the middle at 32/255 with
corners at 111, and the page stopped being a dark room at all. Judge a change on
the page middle and the corner spread, not on how good one screenshot looks.

### Glass

Top-level cards use `.card-sheen.glass` (`BOX` / `Panel` / `SCORE_CELL` in
`src/components/ui/Panel.tsx`):

- fill: `color-mix(in oklch, var(--card), transparent 55%)`
- blur: `blur(40px) saturate(1.9)` — write `-webkit-backdrop-filter` first, standard last
- edge: inset white hairline top (30% white) + faint bottom (12% white) + `inset 0 0 0 1px var(--border)`
- outer lift: `0 14px 36px -18px` near-black
- ring: `ring-1 ring-foreground/20`

Nested wells use `.glass-well` (`CARD`):

- fill: `color-mix(in oklch, var(--muted), transparent 64%)`
- blur: `blur(24px) saturate(1.7)`

No second card-in-card.

The saturation lift is what makes it refract rather than tint. Do not put opaque
`bg-card` on a top-level panel — the field has to read through the pane. The
same holds one level down inside chrome: the bottom dock's own well is
`.glass-well` rather than `bg-muted` for exactly this reason (§7), and it sits
over the brightest corner of the field, so an opaque fill there showed more than
anywhere else.

### Chrome is glass too, and its alpha is the glow's alpha

`--background` is pure black, so every `bg-background/N` bar is a black veil and
**N is exactly how much of the field it eats**. The header and dock sit over the
brightest parts of the field, so that is where an opaque bar shows most. Lab's
dock was `/95` — effectively solid — and the glow visibly stopped dead at the
chrome. All four chrome surfaces are `bg-background/35 backdrop-blur-2xl` now:
desktop header wrapper, desktop dock, mobile top bar, mobile tab bar.

The blur carries legibility, not the opacity. Measured with each surface's own
children hidden so the glass is what gets sampled: header glass `rgb(26,24,15)`,
foreground 17.18, muted 8.57; dock glass `rgb(11,20,30)`, foreground 17.91,
muted 8.94. Do not raise these toward opaque to "fix" contrast without measuring
first — and sample a point the DOM says is empty, because a brightest-pixel scan
catches a control or the logo mark and reports a false failure.

### One pane, not two

The header row and the status strip are **one wrapper with one fill and one
blur**, not two stacked translucent elements. Two blurs sample two different
backdrops, so they can never match: the bands come out at different tones with a
seam between them. Merging the fills is not enough on its own — a `border-b`
between the rows keeps the two-pane read alive. The only edge the chrome carries
is the one at its bottom, where it meets the page.

Measured after: walking the band top to bottom at a text-free column, luminance
goes 15.0 → 12.9 with a biggest single-pixel step of 0.93/255.

If the two rows hold something stateful, keep **one** instance of it and let the
single wrapper change behaviour at the breakpoint. Lab's status strip runs a
one-second interval and a visibilitychange listener; rendering it once per
breakpoint would run two of each.

---

## 7. Chrome / IA (the shared shell)

Desktop header, left to right:

1. Gold mark + UPSIDE LAB
2. Hairline + current room title (muted)
3. Page actions, Feedback
4. Workspace rooms: Portfolio / Fund / Circle (active = `bg-primary text-primary-foreground`)
5. Account avatar (`size-8 rounded-md`)

Lab itself is a meta-tab with sub-tabs: Allocation, Risk, Trends, Seasonality.

Icons: lucide, thin stroke. In buttons, `data-icon`, default `size-4`.

### The dock: one well, one cell per destination — **New 2026-08-21**

Home · Pulse · Lab · Growth · Circle — and on desktop, **one more cell per
portfolio the reader owns** — all drawn as the same cell in the same
`.glass-well`. Active cell is the warm-yellow pill, black type. The phone shows
the five sections only, and reaches portfolios through a picker in its header
title — which is where the desktop dock borrowed its answer for a long book.

It used to be two controls sharing a row: a fixed `42rem` well of app sections
on the left, and on the right — taking every remaining pixel — a heading reading
"Sheets" over a scrolling text rail of portfolio tabs, an inline name field for
creating one, and a `+ New` button. Nothing matched across the seam: 48px against
44px, a filled chip against a 2px underline, and a section label printed into
chrome that no other control needed.

The measurement that settled it: at 1440px with an **empty** book, 464px of the
page column — 40% — was held open for a list with nothing in it.

The rules worth porting, none of which depend on Lab's figures:

- **Never reserve chrome for a list whose length is the reader's data.** One
  item costs one cell; none costs nothing. Anything sized for the largest case
  is wrong for the common one, and the common case here is a single portfolio.
- **Content-sized and centred, not stretched.** Lab tried the full page column
  first: five cells across 1152px left each label adrift in a 230px chip and
  turned the active one into a slab of accent the width of a paragraph. `w-fit`,
  `mx-auto`, fixed cell width — the row then grows by exactly one cell.
- **Every cell the same shape, without a repeated glyph.** Five identical wallet
  icons would be noise, so the user-named cells spend their glyph slot on data:
  a dot in the day's direction (`--gain` / `--loss`, `currentColor` at 40% when
  there is no quote yet). Same 16px slot, so the grid stays uniform.
- **Short labels in a dock.** Lab's desktop dock used to spell out "Overview"
  and "Compound"; the phone had always said Home and Growth. The long forms cost
  ~30px a cell for meaning the page header already carries, and they were what
  pushed a four-portfolio row into truncating on a small laptop.
- **Creating a thing is a glyph cell, not a control cluster.** A narrow `+` cell
  sitting with the items it makes, opening the same dialog the phone opens. That
  one cell retired a labelled button, a section heading, and an inline name
  field — a third code path for creating a portfolio that only desktop had.
- **The well is glass, like the bar around it.** An opaque `bg-muted` well
  inside a translucent chrome bar is a hole punched in the field, and it shows
  precisely because the dock sits over the brightest corner of it. Both of Lab's
  docks moved to `.glass-well` (§6).

On the phone the cells stack icon over label, and the labels are always on —
there is no icons-only breakpoint any more.

### Folding is measured, not guessed

**Two different limits run out, at different widths, and a design that checks
only one of them is wrong half the time.**

- **Count.** Past a cell count the row outgrows the page column.
- **Width.** A row can fit the count and still squeeze every cell too narrow to
  read. Ten cells inside a 768px column is 74px each, and `Growth` truncates.

So Lab's rule takes both, and **the row measures its own container with a
`ResizeObserver` rather than reading a breakpoint**: what decides the fit is the
column's width, which is the same number at 1024px with a wide gutter as at
900px with a narrow one. Past either limit the portfolios fold into a single
cell that opens a list, with **New portfolio** at its foot.

The minimum cell width is *derived from the longest fixed label*, not picked. A
section label is a word the reader cannot infer from a stub, so it must never
truncate; a user-named cell may. Re-derive it for your own labels and font.

Lab's current figures, all of which are the part to re-measure rather than port
(`src/lib/dock-cells.ts`, `BookModeDock.tsx`):

| | |
|---|---|
| Cell width / add cell | `7.5rem` / `2.5rem` |
| `MAX_DOCK_CELLS` | 9 |
| `MIN_CELL_PX` | 96 (`Growth` ≈ 90px with glyph, 6px gap, `px-2`) |
| Dock height, page bottom clearance | 73px, 105px (was 95 / 127) |
| Well surface, contrast | `rgb(18,21,25)` — foreground 17.54, muted 7.09 |

Verified at 768 / 900 / 1024 / 1280 / 1440 against 1, 4 and 6 portfolios, with
truncation checked per cell (`scrollWidth > clientWidth`) rather than by eye. No
section label clips at any of them; four portfolios stay inline from 1024 up.

**Check any lowered cap against a real book before shipping it.** Lab's seed
household has four portfolios, so a cap of 8 would have folded the dock for the
person who asked for the redesign.

### Anything floating above the dock must clear it at every width

(New 2026-08-21.) Lab's assistant button carried `lg:bottom-8` — a flat 2rem offset —
while the dock is `fixed inset-x-0 bottom-0` at all widths, so on desktop the
button sat *underneath* it. Two consequences, both invisible while the dock was
near-opaque and both exposed the moment it became translucent: the dock's
backdrop blur sampled the button's warm fill and smeared it across the corner as
a yellow haze, and clicks in that corner hit the dock, so the button was
unreachable on desktop. Use the live measured dock height (`--dock-pad`, written
by `useDockPad`) as the offset, and give anything else anchored to the same
corner — a consent banner, a toast — clearance above it too.

---

## 8. Components (do not hand-roll)

Real shadcn primitives: Button, Input / Field, Card, Badge, Dialog, Select, Avatar, Progress, ToggleGroup, AlertDialog, Sonner.

Lab-specific patterns to copy, not reinvent:

- `Panel` / `BOX` / `SCORE_CELL` / `LIST` for cards
- `MicroLabel` for any label over a figure or a list, and `NoteRows` for a
  label-plus-prose stack (New 2026-08-21 — see the label voice in §4)
- `Segmented` (filled toggles) and `HairlineGrid` (chip rows). Column count must divide the child count. Never `grid-cols-N` on `gap-px bg-border` with a leftover empty cell.
- `Scoreboard` / `Score` for number tiles (`gap-4` cards)
- Gain/loss as `text-gain` / `text-loss` (or Badge). Left-edge accent bar on a mover card is allowed (`border-l-4`). Fill washes are not.

Button default: `bg-primary text-primary-foreground`, hover mix 10% white into primary, `hover:scale-[1.015]`, `rounded-lg`, `h-8`.

---

## 9. Copy and voice (anything a person reads)

No em dashes. No market slang (sleeve, marks, tape, conviction, drawdown, beta, dry powder, rotation, alpha, moat, NAV). Thesis is allowed (Thesis intact / Thesis watch / Thesis broken).

A 12-year-old and a 75-year-old should get every sentence.

A worked example, because the rule is easy to nod at and still break. Lab's
sign-in sample read: *"Check whether cheaper launches still hold, or this is
just a bounce."* Two failures in one sentence — "cheaper launches" is a thesis
nobody outside that example knows, and "a bounce" is the banned slang. It also
told the reader to check something without saying why it mattered. It now reads:
*"$RKLB rose 6.8% today while Amazon and Microsoft barely moved. When one name
climbs on its own, the question is whether something changed at the company, or
whether the price just ran ahead of itself."* Observation, then the reason it is
worth a second look.

Product line Lab uses: "See what your portfolio did. Ask Margus if the thesis still holds."

Not financial advice. Keep that framing on AI surfaces.

---

## 10. CSS starter Arena can paste

```css
:root {
  --background: oklch(0 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --primary: oklch(0.8 0.09 90);
  --primary-foreground: oklch(0.145 0 0);
  --secondary: oklch(0.269 0 0);
  --accent: oklch(0.269 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 16%);
  --input: oklch(1 0 0 / 18%);
  --ring: oklch(0.8 0.09 90);
  --warning: oklch(0.63 0.22 45);
  --gain: oklch(0.696 0.17 162.48);
  --loss: oklch(0.645 0.21 16.439);
  --ambient-cool: oklch(0.72 0.13 250);   /* chrome-only; no Tailwind utility */
  --radius: 0.625rem;
  --font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", "Geist Mono Fallback", ui-monospace, monospace;
  --font-heading: "Archivo", "Archivo Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-logo: "Archivo", "Archivo Fallback", ui-sans-serif, system-ui, sans-serif;
}
```

Stack: Next.js App Router, Tailwind v4, shadcn/ui, Geist + Archivo.
Source files if a token is in doubt: `src/app/globals.css`, `DESIGN_TOKENS.md`, `src/components/ui/Panel.tsx`, `src/lib/page-shell.ts`, `src/components/UpsideLogo.tsx`.

---

## 11. How to keep this document true — **New 2026-08-21**

This file went stale in five sections in a single day, because it records
another repository's system and nothing in Lab's CI knows it exists. Two habits
keep that from repeating.

**Re-read it whenever Lab's `DESIGN_TOKENS.md` gains a section.** That file is
where Lab records a change and why; this one is the copy Arena reads. They drift
in one direction only.

**It drifted again the same day, which is the point.** This file was refreshed
against Lab at `f8b0435` plus the chrome work in flight, and Lab redesigned its
bottom dock hours later — so §7 was already one round behind before the refresh
had been merged. Nothing failed; nothing could. Treat "Lab shipped today" as the
trigger, not "Lab finished".

**Prefer the mechanism to the number.** Lab's `170vw 112vh` will move again;
"sized in viewport units, anchored off-screen, peak alpha held while the tail
grows" will not. Where this document gives both, the reasoning is the part to
port and the figure is the part to re-measure. Arena has already diverged on the
mark and the accent (`ARENA_MARK.md`), so several of the numbers here would be
wrong for Arena even when they are right for Lab — the alpha of an ambient lobe
most of all, since it depends on the hue's own luminance.
