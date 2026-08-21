# Upside Arena

A free weekly stock-picking game you play with friends. Play money only,
nothing redeemable, nothing real at stake.

Arena shares Upside Lab's shipped visual system as its brand shell. The tokens,
type, radius and glass treatment in `src/app/globals.css` come from
[`docs/brand/UPSIDE_LAB_BRAND_FOR_ARENA.md`](docs/brand/UPSIDE_LAB_BRAND_FOR_ARENA.md)
and are a locked constraint, not a starting point. There is one brand accent, a
quiet warm yellow. There is no second palette, no light theme, and no violet.

Arena's logo mark is its own: the same faceted gem-cut technique and gold hue
family as Lab, cut into an open chevron rather than Lab's solid standing "A".

## Status

Phase 1 of nine: auth, user profiles, the installable shell, and the 16+ age
gate. See [`docs/PHASE_1.md`](docs/PHASE_1.md) for what is built, how to run
it, and what is deliberately absent.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

## Stack

Next.js App Router, Supabase (Postgres, auth, row level security), Tailwind v4,
shadcn/ui, Geist, and a hand-rolled service worker for the PWA shell.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run check` | Types, lint and unit tests |
| `npm run test:e2e` | Playwright, signed-out flows |
| `npm run icons` | Regenerates icons from the Arena mark |

## A note on the numbers

Nothing in the app shows an invented figure. Where a real number does not exist
yet, the screen says so. This product asks people to trust a scoreboard, and a
placeholder teaches them not to.
