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

On top of all of that, four things that answer the same complaint from
different directions — that the week was the only game there was.

**Battles.** A league can run a second contest beside the house week, with its
own rule book and its own length: semiconductors only, one company all week,
coins with a market that never shuts, or short selling, where you pick what
will fall. Any member may start one, one runs at a time, and it can last a day
or a year. Nothing about a battle touches a career: `score_cycle` credits
`weeks_played`, a best week and the season for the house week and nothing else,
because a season anybody could enter by choosing a format that suited them
would not be a season.

A battle is a `weekly_cycles` row with a league on it, which is the decision
worth knowing before reading any of it —
[`0017_battles.sql`](supabase/migrations/0017_battles.sql) argues it out. The
rule books themselves are code, in
[`src/lib/game/formats.ts`](src/lib/game/formats.ts), and the lengths are in
[`src/lib/game/lengths.ts`](src/lib/game/lengths.ts). Both are pure, so the
rule a player reads is the rule the trade is checked against.

**Draft night.** A battle whose universe is a finite list can be drafted
instead of bought: everybody sits down at once, picks in a snake order off one
shared board, and a company that has gone is gone for everybody else. That is
what makes it safe to show every pick live, where a live portfolio never is,
since a name you can see taken is a name you cannot buy. The board is a unique
index rather than a screen, so two phones tapping the same company in the same
second are decided by the database; the running order is written down before
the first pick; the clock picks rather than skips; and you hold what you
drafted, enforced in `execute_trade`. `0031_draft_night.sql` and
[`src/lib/game/draft-order.ts`](src/lib/game/draft-order.ts) are where it
lives.

**Lineups.** Friday's close to Monday's open is sixty-five hours in which
nothing can happen, which used to be answered with a sentence saying the market
was shut. Over the weekend you can now name up to eight companies and they are
bought at Monday's opening price. Everybody fills at that same price whenever
the fill actually runs, and it locks at the bell, because from that moment the
price is known. An order that cannot be priced or afforded is recorded as not
having run and says why on screen.

**A league that remembers.** The week resets every Monday, which is what keeps
somebody who joined last night level with somebody who has played for a year --
and it left a league with no memory at all, which is the other half of why
people stay. So a league keeps a record: who won each week, weeks won all time,
and how you have done against each other person one at a time. A five week form
strip on the league page and a room behind it.
[`src/lib/game/record.ts`](src/lib/game/record.ts) reads it; nothing there is
recomputed, because every figure was settled on a Friday.

**A reason to open it on a Tuesday.** Home shows what actually moved today,
from a watchlist shared by everybody plus whatever the player holds, so the
cost is per symbol rather than per person. It says outright that a big move is
not a reason to buy anything. And the profile shows every week somebody has
played, rather than only the totals those weeks add up to.

**The rules, written down.** [`/how`](src/app/how/page.tsx) is what the app is
and how it is meant to be played, readable without an account, rendered from
the same data the game is played by so it cannot disagree with the rules. It is
linked from the landing page, from onboarding, from the profile and from the
first-week list on Home.

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

Arena sends one kind of mail: the notification fallback, to a player who
asked to be told about something, at the address on their account, when push
reached no browser. Sign-in used to be a magic link and is now Google alone,
so nothing is mailed to an address a stranger typed. What the app checks
before sending, and the dashboard settings that cannot be done in code, are in
[`docs/EMAIL.md`](docs/EMAIL.md).

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
| `npm run test:a11y` | axe over every screen, against WCAG 2.1 AA |
| `npm run icons` | Regenerates icons from the Arena mark |
| `npm run test:scale` | The rooms' own queries against 2,000 players and 12 weeks of history |
| `npm run test:race` | Sixteen real connections racing the three places concurrency bites |
| `npm run check:prerender` | That the public routes still have a static shell |
| `npm run migrate` | Applies `supabase/migrations` and reports which are already there |

## A note on the numbers

Nothing in the app shows an invented figure. Where a real number does not exist
yet, the screen says so. This product asks people to trust a scoreboard, and a
placeholder teaches them not to.
