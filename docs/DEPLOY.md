# Deploying Upside Arena

Arena runs on Vercel, in the same Vercel team as Upside Lab, against its own
Supabase project. Nothing here is shared with Lab except the company behind it.

## Vercel project

| | |
|---|---|
| Team | `upthink-solutions` |
| Project | `upside-arena` |
| Repository | `martinaasa-dotcom/upside-arena`, branch `main` |

## Environment variables

Set these in the Vercel project under Settings, Environment Variables, for
Production and Preview both. None of them belongs in the repository.

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the Arena project URL | Public. Safe in a browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key | Public. Row level security protects it. |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret key | **Server only.** Bypasses row level security. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | `https://upsidearena.com` | Used to build sign-in links. Wrong value means sign-in emails point somewhere useless. |
| `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` | `false` | Turn to `true` only once the Google provider is enabled in Supabase. |
| `CRON_SECRET` | a long random string | **Server only.** Shared with the GitHub workflows below. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the VAPID public key | Public. It is handed to the browser to subscribe with. |
| `VAPID_PRIVATE_KEY` | the VAPID private key | **Server only.** Signs every push. |
| `RESEND_API_KEY` | a Resend API key | **Server only.** Only used for the email fallback. |
| `RESEND_FROM` | `Upside Arena <arena@upsidearena.com>` | Optional. Must be a verified sender in Resend. |
| `ARENA_ADMIN_EMAILS` | your email address | **Server only.** Comma separated. Who may open `/metrics`. Unset means nobody. |
| `STRIPE_SECRET_KEY` | from the Stripe dashboard | **Server only.** Without it nothing is on sale. |
| `STRIPE_WEBHOOK_SECRET` | from the Stripe webhook endpoint | **Server only.** Without it the webhook refuses everything. |
| `STRIPE_PLUS_PRICE_ID` | the recurring price's id | The subscription only appears once this is set. |
| `NEXT_PUBLIC_LAB_URL` | `https://upsidelab.app` | Optional. Where the handoff points. |

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

Two things must be updated or sign-in silently breaks.

1. **`NEXT_PUBLIC_SITE_URL`** in Vercel becomes `https://upsidearena.com`.
   Sign-in links are built from it, so while it says `localhost` every emailed
   link points at a machine the recipient does not have.

2. **Supabase redirect allow list**, under Authentication, URL Configuration:
   - Site URL: `https://upsidearena.com`
   - Redirect URLs: `https://upsidearena.com/auth/confirm`,
     `https://upsidearena.com/auth/callback`, and the same two on
     `http://localhost:3000` for local work.

   Supabase refuses to redirect anywhere not on this list, which is what stops
   a sign-in link being redirected to somewhere it should not go.

## Settling the week, without paying for a scheduler

Vercel's Hobby plan runs a cron once a day at an hour it chooses, which cannot
be relied on to fire after Friday's close. Arena does not need it to.

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

To switch it on:

1. Make a **recurring price** for Arena Plus in the Stripe dashboard and put
   its id in `STRIPE_PLUS_PRICE_ID`. The price lives in Stripe, not in this
   repository, so changing it never needs a deploy.
2. Turn on **Stripe Tax**, so VAT and sales tax are worked out for you rather
   than by us.
3. Turn on the **Customer Portal**, with cancellation enabled. That is what
   satisfies the click-to-cancel rule, and Arena has no other cancel path on
   purpose.
4. Add a webhook endpoint pointing at `/api/stripe/webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` and
   `invoice.payment_failed`. Put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.

Coin bundle prices are in `src/lib/billing/plan.ts` rather than in Stripe,
because a one-off price has to be checked against a list the server controls:
the bundle id comes from the browser, and the price must never.

Two things that are deliberate and worth not undoing. Every webhook is claimed
in the database before it is acted on, so Stripe retrying is never a replay.
And a failed payment marks the subscription past due rather than revoking it,
because Stripe retries a card for days and cutting somebody off on the first
failure turns a renewal that would have worked into a lost subscriber.

## Plan limits worth knowing

The team is on Vercel's **Hobby** plan, which is for non-commercial use only.
Arena is free with no ads, so it fits today.

**Taking a payment does not fit, and this is the one thing that has to be
sorted before the paid tier is switched on.** The code is written and tested;
setting the Stripe keys on a Hobby deployment would put the project in breach
of Vercel's terms. Upgrade to Pro first, then set the keys. Nothing else about
Arena needs Pro: scheduling has not been a reason to upgrade since the
settlement work in phase 3.

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

## Migrations

Migrations are not applied automatically. After deploying a change under
`supabase/migrations`, apply it to the Supabase project, either with
`npx supabase db push` against a linked project, or by pasting the file into
the SQL editor. The app expects the schema to be there before it starts.
