# Phase 1: auth, profiles, PWA shell, age gate

What is built, how to run it, and what deliberately is not here yet.
Phase order is set by section 11 of the product plan.

## What phase 1 covers

| Plan item | Where it lives |
|---|---|
| Auth | `src/app/auth/`, `src/lib/supabase/`, `src/proxy.ts` |
| User profiles | `src/app/(app)/profile/`, `supabase/migrations/0001_profiles.sql` |
| PWA shell | `public/manifest.webmanifest`, `public/sw.js`, `src/components/InstallPrompt.tsx` |
| ToS and age gate | `src/app/legal/`, `src/lib/legal.ts`, the age gate on sign-in and onboarding |
| Design tokens | `src/app/globals.css`, applied from the first commit |

Also built, because the plan calls for them early rather than as a retrofit:

- **Data export and deletion** (`/api/account/export`, `delete_own_account`).
  Section 8 asks for privacy rights, and section 5 notes they are cheaper to
  build now than later.
- **A persistent rating column** on `profiles`. Nothing reads it yet. Section
  2.2 asks for it from day one because it is expensive to retrofit.
- **An analytics call site** (`src/lib/analytics.ts`). Section 2.8 asks for
  instrumentation threaded through every phase. Events are dropped until a
  vendor key is set, so no vendor is locked in yet.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

The app renders signed out with no credentials at all, which is enough to work
on the landing page, the legal pages and the design system. Sign-in needs a
Supabase project.

### Supabase setup

Use a **project of Arena's own**. Do not point this at Upside Lab's project:
section 10 of the plan is explicit that an Arena bug, migration or row-level
security mistake must not be able to reach the real-money product.

1. Create a project, then copy its URL and anon key into `.env.local`.
2. Apply `supabase/migrations/0001_profiles.sql`, either with
   `npx supabase db push` against a linked project, or by pasting it into the
   SQL editor.
3. In Authentication, add `http://localhost:3000/auth/confirm` and
   `http://localhost:3000/auth/callback` to the redirect allow list.
4. Email sign-in works immediately. For Google, turn the provider on in
   Supabase and set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`.

The whole local stack (`npx supabase start`) also works if Docker can reach
Docker Hub.

## Checks

```bash
npm run check      # types, lint, unit tests
npm run test:db    # the migration, its triggers and row level security
npm run test:e2e   # Playwright, signed out flows
```

`npm run test:e2e` builds and serves the app on port 3100 by itself. On a
machine whose Chromium does not match the pinned Playwright version, point at
the local one: `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e`.

`npm run test:db` needs a local Postgres and nothing else. It rebuilds a
scratch database, applies `supabase/tests/shim.sql` (which recreates only the
parts of a Supabase project the migration leans on: the auth schema, the three
PostgREST roles and `auth.uid()`), runs the migrations, then asserts the
security rules actually hold: that a player reads only their own row, cannot
write to anyone else's, cannot raise their own rating or invent a lifetime
record, cannot clear a recorded age confirmation, and that closing an account
erases it and nothing else. Point it at a non-default psql with
`PSQL="sudo -u postgres psql" npm run test:db`.

The end-to-end suite covers what a signed-out visitor can reach, which is
everything that runs without credentials: the landing page, the age gate,
route protection, the legal documents, the manifest and worker, the locked
colour tokens, and the accessibility basics. Flows behind a session are
covered by the unit tests plus manual testing against a real project, listed
below.

### Testing the signed-in flow by hand

With a project configured:

1. Sign in with your email. The link should arrive and land you on
   `/onboarding`, not `/home`.
2. Pick a name and a player tag. A tag that is already taken should say so
   rather than failing silently.
3. You land on `/home`. The header, dock and profile all show your name.
4. On `/profile`, change your name and save. Download your data and check the
   file contains your profile and your recorded agreements.
5. Sign out. `/home` should send you back to the landing page.
6. Close the account from `/profile`. Signing in with the same address should
   produce a fresh, un-onboarded account.

## Decisions taken inside phase 1

These were not open questions in section 13, so they were settled here rather
than escalated.

- **Sign-in is a magic link, with Google behind a flag.** Section 5 prefers a
  magic link or OAuth over raw passwords. The link needs no provider setup, so
  it is the default; Google matches how Lab signs people in and switches on
  with one environment variable.
- **A player tag as well as a display name.** Standings, invitations and rival
  callouts all need a stable, unique handle, and display names collide.
- **The age gate is stored, not just checked.** A browser checkbox is not a
  record. `profiles.age_confirmed_at` is written on the server and a database
  trigger stops it being cleared afterwards.
- **Terms acceptance is versioned.** `terms_acceptances` is append-only per
  document version, so a later revision can be re-prompted without losing the
  earlier consent.
- **The install prompt waits for a finished week.** Section 2.4 asks for a
  well-timed prompt rather than one on page load, so it needs
  `weeks_played >= 1` and stays dismissed for 30 days once waved off. Nobody
  reaches it yet, since weeks start in phase 2.
- **A player can read only their own profile.** Nothing in phase 1 shows
  another player, so the select policy is scoped to the owner. Phase 3 should
  add a policy scoped to shared league membership rather than widening this
  one to every signed-in account.
- **The dock carries only rooms that exist.** Home and Profile. A tab leading
  nowhere is worse than a short dock.

## Deliberately not built yet

No portfolio, no trades, no market data, no leagues, no streaks, no
notifications, no share card, no payments. Those are phases 2 to 8.

Nothing in the app displays an invented number. `/home` shows lifetime totals,
which are genuinely zero for a new account, and says plainly that the first
week has not started. A placeholder portfolio value would teach players to
distrust every number in the product.

## Still open

Section 13 of the plan lists three open decisions. None of them blocked phase
1, and all three are needed before the phase they belong to:

- **Starting virtual balance** ($10k or $100k). Needed for phase 2.
- **What earns a streak day** (opening the app, or making a trade). Needed for
  phase 4.
- **Season length** (monthly or quarterly). Needed after the weekly loop is
  validated.

Three more that phase 1 has surfaced:

- **The registered company details** in `src/lib/company.ts`. Needed before the
  legal pages can be published.

- **A market data vendor** must be picked before phase 2. The plan lists
  Finnhub, IEX Cloud and Alpha Vantage as candidates.
- **An analytics vendor** must be picked before events are worth collecting.
  `src/lib/analytics.ts` is the only call site, so this is a small change.

## Legal

`src/app/legal/terms` and `src/app/legal/privacy` are written against the rules
that actually apply to Arena. The company is established in the European Union,
so the GDPR applies to it as a controller wherever players live, and the plan's
North American launch brings in California's privacy law as well.

The terms carry the provider details EU rules require a service to publish, an
explicit statement that nothing is redeemable and money never buys an
advantage, the acceptable-use rules and what happens when they are broken, a
notice-and-action route for reporting content, the user-content licence, the
warranty and liability sections with the carve-outs that cannot lawfully be
excluded from a consumer, the commitments that apply if paid features are ever
added, a change process, and a dispute section that keeps a consumer's right to
sue where they live rather than pretending they can be forced elsewhere.

The privacy policy carries the full set of disclosures the GDPR makes
mandatory: who the controller is, what is collected, the purpose and the legal
basis for each use, who it is shared with by name, the basis for any transfer
out of Europe, how long each category is kept, every data subject right and how
to use it, the supervisory authority to complain to, and a statement on
automated decisions. It also carries the separate California section, including
the explicit statement that data is neither sold nor shared for advertising.

Two things follow from writing them this way:

- **`src/lib/company.ts` still has placeholder values.** The registered company
  name, registry code and address are not known here. While any of them is
  unfilled, both legal pages render a visible draft notice, so an unconfirmed
  detail cannot quietly ship as though it were real. Fill that file in and the
  notice disappears.
- **Consent is now enforced in code, not just described.** The policy says
  nothing is measured until you agree, so `track()` drops every event until
  consent is granted, a banner asks on first visit with refusing exactly as easy
  as accepting, and the choice can be reversed from the profile page.

These documents have not been reviewed by a lawyer. That is a deliberate,
recorded decision by the product owner, not an oversight. A lawyer is still the
right call before taking a first payment, because the subscription and
auto-renewal rules in section 8 of the plan carry real penalties and depend on
facts about the business rather than on the code.
