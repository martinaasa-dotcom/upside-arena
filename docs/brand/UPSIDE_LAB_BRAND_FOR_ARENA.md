# Upside Lab visual system (for Upside Arena)

> **Superseded in part.** This records Lab's system as of the capture date and
> the constraint Arena started from. Arena has since diverged on the mark and
> the accent by explicit decision: the mark is a parted aqua stone, and
> `--primary` is a warmer amber. See `docs/brand/ARENA_MARK.md`, which wins
> where the two disagree. Everything else here still holds.

Live product: https://upsidelab.app
Captured: 2026-08-20 audit screenshots under `audit-final/`. Tokens below are from live source (`src/app/globals.css`, `DESIGN_TOKENS.md`) as of 2026-08-21. The system is shipped, measured, and settled. Arena should share this brand shell and diverge only in execution (rooms, interaction, game-like surfaces), not in palette, type, or chrome.

Do not invent a second dark theme. Do not guess gold/violet/near-white for `--primary`. The current accent is a quiet warm yellow.

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

Banned: violet / purple / magenta (hue 270–330). Do not reintroduce Gold Delta (`oklch(0.762 0.102 80)`) or the Pass-1 violet (`oklch(0.62 0.24 291)`).

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

| Role | Face |
|---|---|
| UI, headings, logo type | Geist (`next/font/google`). Fallback: ui-sans-serif, system-ui. |
| Money, percents, share counts, tickers in tables | Geist Mono, `tabular-nums`. |

Weights: body 400. Headings 600, `letter-spacing: -0.025em`.

Scale:

- Page titles: `text-2xl font-semibold tracking-tight` (matches `h1` 1.5rem / 2rem)
- Card titles: `text-lg`
- Body / labels: `text-sm`
- Chart ticks, Badge, kbd: `text-xs`
- Scoreboard figures: `font-mono text-2xl font-bold tabular-nums`

Sentence case everywhere a person reads it. "Price path", not "Year-by-Year Target Roadmap".

24-hour clock only (`08:30`, never `8:30 AM`). `hourCycle: "h23"`, `hour: "2-digit"`.

Logo type: `UPSIDE` bold + ` LAB` regular, uppercase, `tracking-wide`, Geist. Header size `text-[14px] leading-none`. For Arena: same pattern, `Upside` + ` Arena`.

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
| Header | `h-14` (3.5rem), glass `bg-background/75 backdrop-blur-xl` |
| Status strip | `2.5rem` under the header |
| Touch | coarse pointer / <1024px: buttons min 2.75rem. Desktop stays dense. |

Table rows: fixed `h-10`. Do not wrap a row to two lines.

---

## 6. Surfaces: field, glow, glass

Every signed-in page wraps in `.page-frame` (`src/lib/page-shell.ts`).

Ambient glow (`.page-frame::before`), both lobes in `--primary`, never gain-green:

```css
radial-gradient(1250px 1000px at -4% -8%, oklch(from var(--primary) l c h / 52%), transparent 66%),
radial-gradient(1300px 1000px at 100% 100%, oklch(from var(--primary) l c h / 14%), transparent 72%);
```

Top-level cards use `.card-sheen.glass` (`BOX` / `Panel` / `SCORE_CELL` in `src/components/ui/Panel.tsx`):

- fill: `color-mix(in oklch, var(--card), transparent 38%)`
- blur: `blur(28px) saturate(1.6)` (write `-webkit-backdrop-filter` first, standard last)
- edge: inset white hairline top (24% white) + faint bottom (7% white) + `inset 0 0 0 1px var(--border)`
- outer lift: `0 14px 36px -18px` near-black
- ring: `ring-1 ring-foreground/20`

Nested wells use `.glass-well` (`CARD`): muted at 50% transparent, blur 16px, no second card-in-card.

Do not put opaque `bg-card` on a top-level panel. The glow has to read through the pane.

---

## 7. Chrome / IA (the shared shell)

Desktop header, left to right:

1. Gold mark + UPSIDE LAB
2. Hairline + current room title (muted)
3. Page actions, Feedback
4. Workspace rooms: Portfolio / Fund / Circle (active = `bg-primary text-primary-foreground`)
5. Account avatar (`size-8 rounded-md`)

Bottom dock (desktop and phone): Overview · Pulse · Lab · Compound · Circle. Active tab is the warm-yellow pill, black type. Sheets sit to the right of the dock.

Lab itself is a meta-tab with sub-tabs: Allocation, Risk, Trends, Seasonality.

Phone: icon+label dock. Labels from `xs` (30rem) up in the header; icons-only on very small screens.

Icons: lucide, thin stroke. In buttons, `data-icon`, default `size-4`.

---

## 8. Components (do not hand-roll)

Real shadcn primitives: Button, Input / Field, Card, Badge, Dialog, Select, Avatar, Progress, ToggleGroup, AlertDialog, Sonner.

Lab-specific patterns to copy, not reinvent:

- `Panel` / `BOX` / `SCORE_CELL` / `LIST` for cards
- `Segmented` (filled toggles) and `HairlineGrid` (chip rows). Column count must divide the child count. Never `grid-cols-N` on `gap-px bg-border` with a leftover empty cell.
- `Scoreboard` / `Score` for number tiles (`gap-4` cards)
- Gain/loss as `text-gain` / `text-loss` (or Badge). Left-edge accent bar on a mover card is allowed (`border-l-4`). Fill washes are not.

Button default: `bg-primary text-primary-foreground`, hover mix 10% white into primary, `hover:scale-[1.015]`, `rounded-lg`, `h-8`.

---

## 9. Copy and voice (anything a person reads)

No em dashes. No market slang (sleeve, marks, tape, conviction, drawdown, beta, dry powder, rotation, alpha, moat, NAV). Thesis is allowed (Thesis intact / Thesis watch / Thesis broken).

A 12-year-old and a 75-year-old should get every sentence.

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
  --radius: 0.625rem;
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
}
```

Stack: Next.js App Router, Tailwind v4, shadcn/ui, Geist.
Source files if a token is in doubt: `src/app/globals.css`, `DESIGN_TOKENS.md`, `src/components/ui/Panel.tsx`, `src/lib/page-shell.ts`, `src/components/UpsideLogo.tsx`.
