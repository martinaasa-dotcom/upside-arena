# Upside Arena

A free weekly stock-picking game you play with friends. Play money only,
nothing redeemable, nothing real at stake.

Arena shares Upside Lab's shipped visual system as its brand shell. The tokens,
type, radius and glass treatment in `src/app/globals.css` come from
[`docs/brand/UPSIDE_LAB_BRAND_FOR_ARENA.md`](docs/brand/UPSIDE_LAB_BRAND_FOR_ARENA.md)
and are a locked constraint, not a starting point. There is no light theme.

Arena has since diverged from that shell by explicit decision, and
[`docs/brand/ARENA_MARK.md`](docs/brand/ARENA_MARK.md) wins wherever the two
disagree. The mark is a parted aqua stone rather than Lab's gold letterform,
and `--primary` is that same aqua (`oklch(0.74 0.125 207)`, `#11c0d3`) so the
accent and the mark are one colour rather than two competing ones.

## Status

Phases 1 to 8 are built: auth and profiles, the paper portfolio engine, private
leagues, streaks and cosmetics, notifications, the share card, analytics, and
payments. On top of those, a quarterly season, milestone rewards, and a weekly
goal declared inside a league.

Phase 9, public matchmade pods with promotion and relegation, is built and
dormant. The ladder, the placement and the weekly settlement all run, and
nobody is placed into a pod until 48 people are playing the same week — two
full pods, which is the smallest number that makes a ladder rather than a
leaderboard with a title on it. Below that the pod panel on `/leagues` is
simply absent. The plan asks for the feature to wait for volume, not for the
work to.

[`docs/PHASE_1.md`](docs/PHASE_1.md) is the record of what phase 1 shipped and
why, not a description of the app today.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

The schema is not applied automatically. Every file under
`supabase/migrations` has to be run against the Supabase project before the app
will work — see [Migrations](docs/DEPLOY.md#migrations).

## Email

Sign-in is a magic link, so an address that cannot receive mail is a bounce
against the project's sending reputation rather than a small mistake. What the
app checks before sending, and the dashboard settings that cannot be done in
code, are in [`docs/EMAIL.md`](docs/EMAIL.md).

## Stack

Next.js App Router, Supabase (Postgres, auth, row level security), Tailwind v4,
shadcn/ui, Geist, and a hand-rolled service worker for the PWA shell.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run check` | Types, lint and unit tests |
| `npm run test:db` | Migrations, triggers and row level security, against a plain Postgres |
| `npm run test:e2e` | Playwright: signed-out flows, and every component measured for clipping |
| `npm run gallery` | The component gallery on `/gallery`, for a design pass |
| `npm run icons` | Regenerates icons from the Arena mark |

## A note on the numbers

Nothing in the app shows an invented figure. Where a real number does not exist
yet, the screen says so. This product asks people to trust a scoreboard, and a
placeholder teaches them not to.
