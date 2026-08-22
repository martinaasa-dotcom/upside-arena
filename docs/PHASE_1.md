# Phase 1: auth, profiles, PWA shell, age gate

> **A record, not a description of the app today.** This is what phase 1
> shipped and why. Phases 2 to 8 have since been built on top of it, so where
> this file says something is absent, check the README before believing it.
> Decisions taken here still hold unless a later phase says otherwise, and the
> ones that were left open have since been settled — see *Still open* below.

What phase 1 built, how to run it, and what was deliberately absent at the
time. Phase order is set by section 11 of the product plan.

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

### The gallery, and what it is for

`npm run gallery` mounts `/gallery`: every component that lays out somebody
else's data, holding the widest values it will ever be given — the longest
name the profile form accepts, a figure with a million in it, a subtitle under
a name that already fills its row. Read a design change here rather than
building a scaffold by hand.

The same page is what `tests/e2e/clipping.spec.ts` measures. Four layout
faults shipped in a row that no test could see — a fixed-height row cropping a
wrapped name, a percentage wrapping into the row below, two descriptions
truncated to nothing — and all four are the same fault: an element smaller
than what is inside it. The probe asks the browser that question directly, of
every element, at every width a phone reports. It is checked against a planted
fault so that a skip added later cannot quietly turn it into a test that
passes on everything.

The route is behind `ARENA_UI_GALLERY`, set by the Playwright web server and
by `npm run gallery` and nowhere a deployment can read it. Without it the
proxy sends a signed-out visitor to sign in and the page answers 404 to
anybody with a session, so it cannot be reached on a real site.

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
colour tokens, and the accessibility basics.

### The signed-in flow

Completing a sign-in needs a link from an email, so the signed-in half is not
part of the automated suite. It was verified by hand against a real Supabase
project on 2026-08-21, end to end, and every step passed:

1. Signing up creates exactly one profile automatically, with the name taken
   from the email, the rating at its default and the age gate unconfirmed.
2. A signed-in but un-onboarded account opening `/home` is sent to
   `/onboarding`.
3. Onboarding writes the name, the player tag and the age confirmation, and
   lands on `/home`, which greets the real profile.
4. `/onboarding` is no longer reachable once onboarding is done.
5. Editing the profile saves and survives a reload, so the write passes row
   level security.
6. The data export returns that account's own profile and both recorded
   agreements, and nobody else's.
7. Closing the account erases the profile and the agreements with it, and the
   session stops opening protected rooms. The token afterwards reports
   `user_not_found`, so nothing is left behind.

To repeat it, the quickest route is to turn off **Confirm email** in the
Supabase dashboard under Authentication, sign up a throwaway account, walk the
steps, then **turn Confirm email back on**. Leaving it off lets anyone register
an address they do not own. A better long-term option is a service role key and
the admin `generate_link` endpoint, which needs no setting changed.

### Regression checklist

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

## Not built at the time

No portfolio, no trades, no market data, no leagues, no streaks, no
notifications, no share card, no payments. Those were phases 2 to 8, and all of
them have since been built.

The rule that outlasted the phase: nothing in the app displays an invented
number. Where a real figure does not exist yet the screen says so. A
placeholder portfolio value would teach players to distrust every number in the
product, and that still governs every screen added since.

## Open decisions, and where they landed

Section 13 of the plan listed three open decisions. None blocked phase 1, and
all three have since been settled by the phase they belonged to:

- ~~Starting virtual balance~~. Settled at **$100,000**, in `src/lib/game.ts`.
- ~~What earns a streak day~~. Settled in phase 4 at **opening the app**,
  credited on the home screen and nowhere else, and counted in trading days so
  that a weekend never breaks one.
- ~~Season length~~. Settled at **quarterly**, in `0011_seasons.sql`. A season
  is made when the first week inside it is scored rather than laid out in
  advance, and ranks on points ahead of the market per week.

Two more that phase 1 has surfaced:

- ~~A market data vendor~~. Settled on **Yahoo Finance**, through the same
  `yahoo-finance2` library Upside Lab uses, with Finnhub available as a
  fallback once a key is set. Note that IEX Cloud, which the plan lists, was
  retired in 2024 and is not an option.
- ~~An analytics vendor~~. Settled on **Vercel Analytics**, matching Lab. It
  loads only after consent is given.

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

- **`src/lib/company.ts` carries the same company details Upside Lab
  publishes**: Upthink Solutions OÜ, its registry code, registered office and
  VAT ID, `app.support@upthink.ee` for product help and `privacy@upthink.ee`
  for data requests. Arena is a second product of one company, not a second
  company, so the two sets of documents must not disagree about who is behind
  them. The file still detects an unfilled value and makes both legal pages
  show a draft notice, which is what should happen if a detail is ever cleared.
- **Consent is now enforced in code, not just described.** The policy says
  nothing is measured until you agree, so `track()` drops every event until
  consent is granted, a banner asks on first visit with refusing exactly as easy
  as accepting, and the choice can be reversed from the profile page.

These documents have not been reviewed by a lawyer. That is a deliberate,
recorded decision by the product owner, not an oversight. A lawyer is still the
right call before taking a first payment, because the subscription and
auto-renewal rules in section 8 of the plan carry real penalties and depend on
facts about the business rather than on the code.
