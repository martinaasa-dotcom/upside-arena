# Deploying Upside Arena

Arena runs on Vercel, in the same Vercel team as Upside Lab, against its own
Supabase project. Nothing here is shared with Lab except the company behind it.

## Vercel project

| | |
|---|---|
| Team | `upthink-solutions` |
| Project | `upside-arena` |
| Repository | `martinaasa-dotcom/upside-arena`, branch `main` |

> Setting all of this up for the first time? `docs/SWITCH_ON.md` is the same
> ground as a click-by-click walkthrough, in the order to do it. This file is
> the reference.

## Environment variables

Set these in the Vercel project under Settings, Environment Variables, for
Production and Preview both. None of them belongs in the repository.

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the Arena project URL | Public. Safe in a browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key | Public. Row level security protects it. |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret key | **Server only.** Bypasses row level security. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | `https://upsidearena.com` | Set, on All Environments. Builds sign-in links, notification emails and share urls. If it were ever unset, production falls back to the project's production domain rather than to a deployment url, but that is a safety net rather than the setting. |
| `GOOGLE_CLIENT_ID` | from the Arena Google Cloud project | The Google button appears when this and the secret are both set, and not otherwise. |
| `GOOGLE_CLIENT_SECRET` | from the same client | **Server only.** Arena exchanges the code itself. See [SWITCH_ON.md](SWITCH_ON.md#6-sign-in-with-google). |
| `CRON_SECRET` | a long random string | **Server only.** Shared with the GitHub workflows below. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the VAPID public key | Public. It is handed to the browser to subscribe with. |
| `VAPID_PRIVATE_KEY` | the VAPID private key | **Server only.** Signs every push. |
| `RESEND_API_KEY` | a Resend API key | **Server only.** Only used for the email fallback. |
| `RESEND_FROM` | `Upside Arena <arena@upsidearena.com>` | Optional. Must be a verified sender in Resend. |
| `ARENA_ADMIN_EMAILS` | your email address | **Server only.** Comma separated. Who may open `/metrics`. Unset means nobody. |
| `STRIPE_SECRET_KEY` | from the Stripe dashboard | **Server only.** Without it nothing is on sale. |
| `STRIPE_WEBHOOK_SECRET` | from the Stripe webhook endpoint | **Server only.** Without it the webhook refuses everything. |
| `STRIPE_PLUS_PRICE_ID` | the monthly price's id | The subscription only appears once this is set. |
| `STRIPE_PLUS_YEARLY_PRICE_ID` | the yearly price's id | Optional. Without it there is no yearly choice, only the monthly one. |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Arena's own portal configuration | Only needed when the Stripe account is shared with another product. |

Everything to do with notifications is optional. With no VAPID keys the panel
on the profile page hides itself and nothing is ever sent; with no Resend key
the email fallback is skipped. Neither absence breaks anything else.

The service role key is what lets the server write cash, holdings and trades
while a player can write none of them. If it leaks, rotate it in Supabase and
update it here; nothing else needs to change.

## Domain

`upsidearena.com` is registered with Zone and **keeps Zone as its DNS host**,
which is how `upsidelab.app` is set up too. Vercel is not the nameserver.

That choice matters for email: Resend needs MX and TXT records on the domain,
and those are far easier to manage at Zone alongside everything else. Moving
nameservers to Vercel would mean recreating every mail record there.

Records to set at Zone:

| Type | Host | Value |
|---|---|---|
| A | `@` (the apex) | `76.76.21.21` |
| CNAME | `www` | the target Vercel shows for this project |

The `www` target is unique per project. Vercel prints it when the domain is
added, and it looks like `1a0fc83adc3fbf68.vercel-dns-017.com`. Lab's apex
uses the same `76.76.21.21`, which is Vercel's shared anycast address.

Leave the nameservers alone.

## After the domain resolves

### 1. Site url — done

`NEXT_PUBLIC_SITE_URL` is set to `https://upsidearena.com` in the Vercel
project, scoped to All Environments. Sign-in links, notification emails and
share urls are built from it, and this used to be the outstanding item here.

Two notes on it rather than an action.

**All Environments includes Development.** Anyone pulling the project's
variables to run locally gets the production origin rather than
`http://localhost:3000`, so a sign-in email triggered from a local run points
at production. That is a footgun rather than a bug: nothing breaks, but the
link does not come back to the machine you are testing on. Narrow the variable
to Production and Preview if that ever gets annoying.

**Preview deployments report the production origin too.** That is the right
trade while Supabase's allow list names only `upsidearena.com`, since a preview
origin would be refused anyway. It does mean auth cannot be exercised end to
end on a preview url.

### The fallback, if the variable is ever unset

`siteUrl()` in `src/lib/env.ts` resolves in order: the explicit variable, then
on production the project's production domain (`VERCEL_PROJECT_PRODUCTION_URL`),
then on a preview the deployment url (`VERCEL_URL`), then localhost.

Production deliberately never falls through to `VERCEL_URL`. That names one
deployment, changes on every push, and is not on Supabase's allow list, so a
link built from it would look plausible and fail.

This is defence in depth, not a substitute for the variable. The explicit value
is the only one a person controls and the only one that survives moving off
Vercel.

### 2. Supabase redirect allow list

Under Authentication, URL Configuration:

- Site URL: `https://upsidearena.com`
- Redirect URLs: `https://upsidearena.com/auth/confirm`,
  `https://upsidearena.com/auth/callback`, and the same two on
  `http://localhost:3000` for local work.

Supabase refuses to redirect anywhere not on this list, which is what stops a
sign-in link being redirected to somewhere it should not go.

## Settling the week, without paying for a scheduler

Vercel's cheapest scheduling runs a cron once a day at an hour it chooses,
which cannot be relied on to fire after Friday's close. Rather than pay for a
scheduler to do something the app can notice for itself, Arena does not need
one at all.

**A finished week is settled by the first request that touches the game.**
`getCurrentCycle` checks for a due week with one indexed query and, if it
finds one, settles it in `after()`, so the work happens once the response has
already been sent and nobody waits. A claim in the database means that however
many requests notice at once, exactly one does the work, and a claim whose
owner died is taken over after ten minutes.

That makes correctness independent of any timer. The only thing a schedule
adds is promptness on a quiet weekend when nobody has visited.

For that, `.github/workflows/settle-week.yml` calls `/api/cron/settle` on
Friday evening. GitHub Actions is free on a public repository, and its
scheduler running late does not matter because scoring is idempotent: late,
twice, or never all end in the same place.

To switch the nudge on, add a repository secret named `CRON_SECRET` matching
the environment variable of the same name, at Settings, Secrets and variables,
Actions. Without it the workflow exits quietly and the app carries on settling
by itself. The endpoint refuses every request when the secret is unset, so an
unset variable can never be what makes it public.

## Notifications

Two pieces, and both are optional.

**Push** needs a VAPID key pair, which identifies the sender to every
browser's push service. Generate one with:

```
npx web-push generate-vapid-keys
```

Put the public half in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private half in
`VAPID_PRIVATE_KEY`. Changing the pair later invalidates every existing
subscription: those players are simply never sent anything again, silently, so
treat the pair as permanent once anyone has subscribed.

**Email** is the fallback, and it matters more than it sounds. iOS only
delivers web push to a site added to the home screen, so a large share of
players can never receive a push at all. Email reaches them. It is only used
when no browser of theirs is listening, so nobody gets both.

`.github/workflows/notify.yml` calls `/api/cron/notify` hourly through the
trading day, plus twice at the weekend for a week result that landed while
somebody was asleep. Each pass decides for itself whether now is the right
moment, so the schedule does not have to be clever. It uses the same
`CRON_SECRET` as settling.

The same endpoint records what every portfolio was worth at the day's close,
which is what gives a shared week card its shape. That one cannot be caught up
afterwards, since prices move on, so the app also writes it by itself on the
first request after the close. A missed run costs nothing.

Nothing is sent twice, ever. Every message is claimed in the database before
it is sent, keyed on the event it describes, so a pass that runs twice or
overlaps another sends nothing extra. The database also enforces the limit of
three a day, so a bug in the application cannot spam anyone.

## The numbers

`/metrics` shows the four figures section 2.8 of the plan is tuned by:
retention at one, seven and thirty days, whether streaks survive, how full the
leagues get, and how often a scored week actually gets shared.

Set `ARENA_ADMIN_EMAILS` to the addresses allowed to open it. Unset means
nobody, and the page returns a plain not-found rather than a refusal, so a
stranger never learns it is there.

Everything on that page is counted from Arena's own tables. Nothing about a
player is sent to an analytics vendor to produce it, which means the figures
are true for everybody rather than only for the minority who agree to
measurement, and there is no extra processor to disclose.

Separately, which buttons people press is measured through Vercel Web
Analytics, behind the consent banner. That half only loads once somebody has
said yes, and it carries no names, no tickers, no league names and no figures.
The two halves answer different questions and neither substitutes for the
other.

## Payments

Everything is built and nothing is on sale until the Stripe keys are set. With
none of them the paid page says so plainly, the free game is untouched, and
the webhook returns a not-found.

To switch it on, in Stripe first and Vercel last, so the app never runs with
half of it configured:

1. Turn on **Stripe Tax** (Settings, Tax). VAT and sales tax are then worked
   out by Stripe rather than by us. Set the default tax behaviour to
   **inclusive**: selling to consumers in the EU, the advertised price has to
   be the price paid, and a bundle that says 1.99 and charges 2.45 produces a
   chargeback rather than a second purchase. The coin bundles set this
   explicitly in code; the subscription price takes it from the dashboard.
2. Make a **recurring price** for Arena Plus, with tax behaviour inclusive.
   Its id goes in `STRIPE_PLUS_PRICE_ID`. Optionally make a second, yearly
   price on the same product for `STRIPE_PLUS_YEARLY_PRICE_ID`; with it set,
   `/plus` shows a choice between the two, and without it it shows the
   monthly one alone.

   Both amounts are also written in `src/lib/billing/plan.ts`, because a page
   has to be able to say what something costs before Stripe is asked. Those
   two must agree: checkout retrieves the price and refuses to open if the
   amount, currency or interval differ from what was advertised. So changing
   a price is a dashboard edit **and** a one-line code change, in either
   order, and the worst case in between is a subscribe button that says the
   price is being corrected.
3. Turn on the **Customer Portal** (Settings, Billing, Customer portal) with
   cancellation enabled. That is what satisfies the click-to-cancel rule, and
   Arena has no other cancel path on purpose.
4. Add a webhook endpoint pointing at
   `https://upsidearena.com/api/stripe/webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` and
   `invoice.payment_failed`. Its signing secret goes in
   `STRIPE_WEBHOOK_SECRET`.
5. Only now set the three variables in Vercel and redeploy. Until all three
   are present the paid page says it is not on sale and the webhook returns a
   not-found, which is the right state to be in while half-configured.

Test it end to end with a card before announcing it. Stripe's test mode has
its own keys, its own price ids and its own webhook secret, so a full dry run
costs nothing and proves the webhook is reaching the right URL.

Coin bundle prices are in `src/lib/billing/plan.ts` rather than in Stripe,
because a one-off price has to be checked against a list the server controls:
the bundle id comes from the browser, and the price must never.

Two things that are deliberate and worth not undoing. Every webhook is claimed
in the database before it is acted on, so Stripe retrying is never a replay.
And a failed payment marks the subscription past due rather than revoking it,
because Stripe retries a card for days and cutting somebody off on the first
failure turns a renewal that would have worked into a lost subscriber.

## Where Arena is deployed

Arena deploys under the `upthink-solutions` scope, the same one Upside Lab
uses, and Lab already takes payments there. So taking a payment is not a
blocker on switching the paid tier on.

Worth knowing only because it would bite later: Vercel's **Hobby** plan is for
non-commercial use, so a project that took payments would have to not be on
it. That is a constraint on where Arena is deployed, not on the code.

Scheduling has not been a reason to upgrade anything since the settlement work
in phase 3: a finished week is settled by the first request that touches the
game, and the hourly pass runs on GitHub Actions.

## Deploying

Pushing to `main` deploys, once the repository is connected to the project.
To deploy by hand:

```bash
npx vercel --prod --token "$VERCEL_TOKEN" --scope upthink-solutions
```

Before any deploy, run the checks:

```bash
npm run check      # types, lint, unit tests
npm run test:db    # migrations, triggers, row level security
npm run test:e2e   # signed-out flows
```

### There is a daily cap, and it is easy to hit

The free plan allows **100 deployments a day** across the project. Past that,
every build fails with:

```
Resource is limited - try again in 24 hours
(more than 100, code: "api-deployments-free-per-day")
```

This is not a build failure and no change to the code fixes it. It hit on
2026-08-21 and again on 2026-08-22, and stayed hit for hours both times.

What it means in practice:

- **A merge to `main` does not deploy** while the cap is on. Production keeps
  serving the last build that got through, which can be a long way behind
  `main`. Check what is actually deployed rather than assuming a merge shipped.
- Every push to an open pull request spends one, because each gets a preview.
  A branch pushed twenty times has spent twenty.
- Pushing again to clear it makes it worse.

Upgrading the plan removes the cap. Short of that, the thing to do is stop
spending it on builds nobody looks at — see below.

#### Agent branches do not get a preview

`vercel.json` switches deployments off for `claude/*`:

```json
{ "git": { "deploymentEnabled": { "claude/*": false } } }
```

The numbers are why. On 2026-08-22 the project spent 100 deployments and hit
the cap by mid-afternoon: 37 production and 63 previews, and **every one of
the 63 was an agent branch** — 36 from a single one. Nothing read them. What
actually decides whether a branch is sound is the GitHub Actions run: types,
lint, unit tests, the build, and the browser tests. That is untouched by this,
because it is not Vercel.

With previews off for those branches the same day's work costs 37 deployments
instead of 100, and the cap is not reached at all.

`main` is not matched, so production still deploys on every merge. If a
preview is ever genuinely wanted for one of these branches, take the pattern
out or push under a name that does not match it.

#### Why it is easy to miss

A blocked production deploy is silent. On 2026-08-22 three merges landed on
`main` before anybody noticed production had not moved for over an hour.

- **No deployment is created**, so there is nothing in the Vercel list to see
  as failed — the merge simply produces no build at all.
- **No check fails on the pull request.** GitHub Actions is green, the PR
  merges normally, and nothing anywhere is red. A rejected *preview* does post
  a comment from the Vercel bot, but a rejected *production* deploy on merge
  posts nothing.
- **Nothing retries it.** When capacity returns Vercel does not go back and
  build `main`. It stays stale until something triggers a deploy.

So the merge looks exactly like a successful one. The only way to know is to
ask what is deployed.

#### Checking, and getting unstuck

What production is actually serving, and how much of the cap is spent:

```bash
# The live build, and the commit it came from
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?app=upside-arena&limit=1&target=production&state=READY" \
  | jq -r '.deployments[0].meta | "\(.githubCommitSha[0:12])  \(.githubCommitMessage)"'

# How many deployments are inside the trailing 24 hours
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?app=upside-arena&limit=100&since=$(( ($(date +%s) - 86400) * 1000 ))" \
  | jq '.deployments | length'
```

`created` on the oldest entry is worth reading too: deployments leave the
window 24 hours after they were made, so it says when the first slot frees
rather than when the message first appeared.

Once there is capacity, **one production deploy catches up every merge since
the last one**, because it builds `main`'s head rather than a single commit.
Nothing is lost by the wait. To trigger it: press **Redeploy** on the latest
`main` deployment in the Vercel dashboard, or merge the next pull request.

## Migrations

**Migrations are not applied automatically, and deploying does not apply them.**
A deploy and a migration are two separate acts, and the app can be running code
that expects a table the project does not have.

Three ways to apply one:

- `npx supabase db push` against a linked project. Needs a Supabase access
  token (`supabase login`, or `SUPABASE_ACCESS_TOKEN`), which is not the same
  thing as the service role key. It also connects on 5432, so it needs a
  network that allows that.
- Paste the file into the SQL editor and run it. Needs nothing but the
  dashboard.
- Post it to the Management API, which is the only one of the three that works
  over nothing but HTTPS:

  ```bash
  curl -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_PAT" \
    -H "Content-Type: application/json" \
    --data "$(jq -Rs '{query: .}' < supabase/migrations/0014_pods.sql)"
  ```

  `$SUPABASE_PAT` is a personal access token (`sbp_…`) from Account →
  Access Tokens. This is how `0011` through `0014` were applied to production
  from a sandbox with only port 443 open.

The service role key in `SUPABASE_SERVICE_ROLE_KEY` cannot do this. It
authenticates against PostgREST, which reads and writes rows; `create table`,
`create function` and `grant` are not expressible through that API at all. If
a tool has only that key, it cannot apply a migration, however much it looks
like a key that should.

### What exists

| File | What it adds |
|---|---|
| `0001_profiles.sql` | Profiles, the terms record, the age gate |
| `0002_portfolio_engine.sql` | Weekly cycles, portfolios, holdings, trades |
| `0003_settlement.sql` | Claiming and scoring a finished week |
| `0004_leagues.sql` | Private leagues and membership |
| `0005_streaks_rewards.sql` | Streaks, the freeze, the reward catalogue |
| `0006_notifications.sql` | Push subscriptions, settings, the send record |
| `0007_share_cards.sql` | Portfolio marks and share cards |
| `0008_metrics.sql` | Daily actives |
| `0009_entitlements.sql` | Entitlements, coins, the billing event claim |
| `0010_cosmetics.sql` | Picture rings and themes alongside titles |
| `0011_seasons.sql` | The quarterly season and its standings |
| `0012_streak_bonuses.sql` | What a streak milestone pays |
| `0013_weekly_goals.sql` | The goal declared inside a league |
| `0014_pods.sql` | The public ladder: tiers, pods, placement and settlement |
| `0015_score_needs_every_price.sql` | Refuses to score a week on a price it does not have |

`0015` is the one to apply promptly. Without it a settlement handed an
incomplete set of closing prices values the missing companies at zero and
writes the result as final. The app will not call it that way, so nothing is
wrong today; the migration is what makes that true of the database rather than
of one `if` statement in `settle.ts`.

### How a missing one shows up

Every feature added after `0010` degrades rather than breaking: the season page
says the season starts with your first settled week, no milestone pays, and no
goal can be declared. Nothing else on the site is affected.

That is deliberate, and it is also why a missing migration is easy to miss.
Check rather than infer — the fastest way is to open `/season` while signed in
and see whether it names the current quarter.
