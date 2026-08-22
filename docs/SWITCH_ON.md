# Switching Arena on, step by step

Everything in Arena that is not switched on yet, in the order to do it, written
for somebody who is not going to read the code.

Nothing here is required for the game to work. Portfolios, leagues, streaks,
standings and the share card all run today. Each section below turns on one
optional thing, and each one says so plainly in the app when it is off.

**The golden rule for every Vercel variable below:** tick **Production** and
**Preview**, and leave **Development** unticked. Vercel refuses to save a
secret that targets Development, and the error it gives does not explain that.

**And after every variable change, redeploy.** Variables are read when the app
starts, so a variable added to a running deployment does nothing until the next
one. Vercel, Deployments, the three dots on the newest one, Redeploy.

---

## 0. Get the code and the schema into production

Two separate things, and doing one does not do the other.

**The code.** Merging to `main` deploys it, in two or three minutes. Watch out
for the free plan's cap of 100 deployments a day: past it every build fails
with `api-deployments-free-per-day` and the merge simply does not ship, while
production carries on serving the last build that got through. See
[DEPLOY.md](DEPLOY.md#there-is-a-daily-cap-and-it-is-easy-to-hit).

**The schema.** Every file under `supabase/migrations` has to be run against
the Supabase project by hand, either with `npx supabase db push` against a
linked project or by pasting it into the SQL editor. Nothing applies them for
you, and the service role key cannot do it — see
[DEPLOY.md](DEPLOY.md#migrations).

Confirm both worked, while signed in:

- `https://upsidearena.com/plus` shows the Arena Plus page. If you are sent to
  sign in instead, the deploy has not finished.
- `https://upsidearena.com/season` names the current quarter. If it says the
  season starts with your first settled week, the migrations are not applied.

---

## 1. Push notifications

Two keys, called a VAPID pair. They are what proves to a browser's push service
that a message really came from Arena. They are not bought and not registered
anywhere: they are just generated once and kept.

Ask Claude for the pair, or generate your own if you have Node to hand:

```
npx web-push generate-vapid-keys
```

In **Vercel, Settings, Environment Variables**, add two:

| Name | Value | Sensitive? |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the public half | No |
| `VAPID_PRIVATE_KEY` | the private half | Yes |

The public one is deliberately not marked sensitive: it is sent to every
browser by design, and marking it sensitive stops the app reading it where it
needs to.

Redeploy.

**Confirm it worked.** Sign in, go to **Profile**. A panel called *Being told
things* should now be there with an *On this device* row and a **Turn on**
button. Press it, allow the browser prompt, and it should say Arena can send
notifications to this browser.

**On an iPhone or iPad it will refuse until Arena is on the home screen.** That
is Apple's rule, not a bug. Open upsidearena.com in Safari, press Share, then
Add to Home Screen, and open Arena from the icon. The panel then explains this
itself if you have not done it.

**Never change this pair once anybody has subscribed.** Changing it does not
produce an error: those people simply stop receiving anything, silently, for
ever. Right now nobody is subscribed, so this is the free moment to settle on a
pair.

---

## 2. The email fallback

Push does not reach everybody. On iPhone it only works for people who added
Arena to their home screen, which most people never do. Email covers them, and
it is only used when no browser of theirs is listening, so nobody gets both.

### If upthink.ee is already in Resend for Upside Lab

Then there is no DNS to do. Go to **resend.com**, **API Keys**, **Create API
Key**, name it `upside-arena`, permission **Sending access**. Copy it once; it
is never shown again.

Add to Vercel, sensitive, Production and Preview:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | the key, starting `re_` |

The from address defaults to `Upside Arena <arena@upthink.ee>`. That works as
soon as upthink.ee is verified.

### If you would rather send from upsidearena.com

Better separation from Lab, and worth doing at some point, but it needs DNS.

1. Resend, **Domains**, **Add Domain**, enter `upsidearena.com`.
2. Resend shows three or four records: a `TXT` for DKIM, an `MX` and a `TXT`
   for the return path, and it may suggest a `DMARC` record.
3. Add each one at **Zone OÜ**, in the DNS settings for upsidearena.com,
   exactly as shown. Copy and paste; a single wrong character fails silently.
4. Back in Resend, **Verify**. It can take an hour, sometimes longer.
5. Once it says Verified, add to Vercel as well:

| Name | Value |
|---|---|
| `RESEND_FROM` | `Upside Arena <arena@upsidearena.com>` |

Redeploy.

**Confirm it worked.** On **Profile**, the *Being told things* panel should now
also show an **Email instead** switch. That switch only appears when Resend is
configured, so its presence is the confirmation.

If mail is configured but not arriving, the cause is almost always an
unverified domain. Vercel, the deployment, **Logs**, and look for
`email refused by the provider`. That line exists specifically for this.

### While you are in Resend, point sign-in at it too

The sign-in link is sent by Supabase, not by Resend, and Supabase's built-in
mail is shared infrastructure with a small hourly allowance and a reputation
Arena does not control. Moving it onto the same Resend account is one screen of
settings and it is what stops a run of bounced links from taking sign-in down
for everybody. [EMAIL.md](EMAIL.md#move-auth-email-onto-resend) has the fields.

---

## 3. The hourly pass

**Already done.** `CRON_SECRET` is set in both places and a manual run has
succeeded.

This is what calls Arena every hour through the trading day to record the day's
closing values and to look for anything worth telling somebody about.

Confirm any time: **GitHub, Actions, Trading day pass, Run workflow**. It should
finish green, and the log should end with an `HTTP 200` and a small JSON
summary. The secret appears as `***`, which is correct.

If it ever says *CRON_SECRET is not set on this repository*, then the repository
secret has gone. Re-add it at **GitHub, Settings, Secrets and variables,
Actions, New repository secret**, named `CRON_SECRET`, matching the value in
Vercel exactly.

Nothing breaks if this stops running. A finished week is settled by the first
person who opens the app, and the daily closing values are written the same way.
The schedule only makes both prompt.

---

## 4. The numbers page

A private page showing whether Arena is working: how many people come back after
a day, a week and a month, whether streaks survive, how full the leagues get,
and how often a week actually gets shared.

Add to Vercel:

| Name | Value |
|---|---|
| `ARENA_ADMIN_EMAILS` | `martin.aasa@upthink.ee` |

Several addresses are allowed, separated by commas. Unset means nobody at all.

Redeploy, then open `https://upsidearena.com/metrics`.

Anybody not on that list gets an ordinary page-not-found rather than a refusal,
so nobody learns the page exists.

Most of it will say **Nothing yet** for a while. That is correct and deliberate:
nought per cent reads as a verdict, and on a new product almost everything is
genuinely nothing yet.

---

## 5. Payments

The longest one. Do Stripe completely first and Vercel last, so Arena never runs
half configured.

### 5a. Do the whole thing in test mode first

Stripe has a **Test mode** toggle at the top right. In test mode you get
separate keys, separate prices and a separate webhook, and you can pay with card
number `4242 4242 4242 4242`, any future expiry, any CVC. Nothing is real.

Doing the steps below in test mode first costs nothing and proves the one thing
that cannot be checked any other way: that Stripe can actually reach Arena's
webhook. Then repeat in live mode.

### 5b. Turn on tax

**Stripe, Settings, Tax.**

1. Add the business address and confirm the registrations.
2. Set **Default tax behaviour** to **Inclusive**.

Inclusive matters. Selling to consumers in Europe, the price shown has to be the
price paid. A bundle advertised at €1.99 that charges €2.45 at the end is both
wrong and the fastest route to a chargeback.

### 5c. Make the subscription price

**Stripe, Product catalogue, Add product.**

- Name: `Arena Plus`
- Description: `More streak freezes, bigger leagues, your full history, and two member titles. Nothing that changes a score.`
- Price: `2.99`, **Recurring**, **Monthly**
- Tax behaviour: **Inclusive**

Save, then click into the price and copy its id. It starts `price_`. That is
`STRIPE_PLUS_PRICE_ID`.

**Then add a second price to the same product**, for people who would rather
pay once a year. On the product page, **Add another price**:

- Price: `29.90`, **Recurring**, **Yearly**
- Tax behaviour: **Inclusive**

Its id is `STRIPE_PLUS_YEARLY_PRICE_ID`. That works out at 2.49 a month, which
is what `/plus` says next to it. Leave this out and the page simply shows the
monthly price on its own, with no picker.

Both amounts are written down in `src/lib/billing/plan.ts` as well, because
the page has to be able to say what something costs without asking Stripe on
every render. They have to match: before checkout opens, Arena retrieves the
price and refuses if the amount, the currency or the interval is not what it
just advertised. If you change a price in the dashboard, change it there too.

Do not put a price for coins here. Coin bundles are priced in the code, in
`src/lib/billing/plan.ts`, because the bundle a browser asks for must be checked
against a list the server controls.

### 5d. Turn on the customer portal

**Stripe, Settings, Billing, Customer portal.**

1. Turn on **Customers can cancel subscriptions**.
2. Choose **At end of billing period**, not immediately. They have paid for the
   rest of the period.
3. Turn on **Customers can update payment methods**.
4. Save.

**This account is shared with Upside Lab, so Arena names its own
configuration rather than relying on the account default.** Set the
configuration id, which starts `bpc_`, in Vercel as
`STRIPE_PORTAL_CONFIGURATION_ID`. See the section below for what is already
in place.

This is not optional. Cancelling has to be as easy as subscribing, and Arena has
no other cancel path anywhere on purpose.

### 5e. Add the webhook

**Stripe, Developers, Webhooks, Add endpoint.**

- Endpoint URL: `https://upsidearena.com/api/stripe/webhook`
- Events to send, exactly these five:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Add it, then **Reveal** the signing secret. It starts `whsec_`. That is
`STRIPE_WEBHOOK_SECRET`.

The signing secret is different in test mode and live mode. Using the wrong one
means every webhook is refused and nobody's payment is ever recorded.

### 5f. Get the API key

**Stripe, Developers, API keys**, the **Secret key**. It starts `sk_test_` in
test mode and `sk_live_` in live mode.

### 5g. Only now, Vercel

Add all three together, sensitive, Production and Preview:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PLUS_PRICE_ID` | `price_...` |
| `STRIPE_PLUS_YEARLY_PRICE_ID` | `price_...`, if you made the yearly one |

Redeploy.

### 5h. Confirm it worked

1. Open `/plus`. The *Not on sale yet* panel should be gone.
2. Press **Take Arena Plus**. Stripe's page should open with the right price.
3. Pay with `4242 4242 4242 4242` if in test mode.
4. You should land back on `/plus` showing **Member**.
5. **Stripe, Developers, Webhooks**, click the endpoint. Every event should show
   `200`. Anything else means Arena did not accept it, and the response body
   there says why.
6. Press **Manage or cancel**. Stripe's portal should open.
7. Buy a coin bundle. The balance at the top of the Coins panel should go up.
8. Buy a title with the coins. It should appear on **Profile** under Titles.

If step 4 shows the page without **Member**, the payment worked but the webhook
did not arrive. That is step 5 to look at, and it is almost always a wrong
signing secret or a typo in the URL.

### 5i. What it costs and what it says

The bundle prices are guesses with no market input behind them. They are in
`src/lib/billing/plan.ts` and changing them is a one-line edit each. The
subscription price lives in Stripe, so changing that never needs a deploy at
all.

---

## 6. Where the Upside Lab link goes

Optional. It defaults to `https://upsidelab.app`, which is right.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_LAB_URL` | only if Lab ever moves |

The link carries an opaque token so Lab can tell that somebody came from Arena,
without Arena putting an email address into a web address that gets pasted
around. For that to be worth anything, Lab has to eventually read the `t=`
parameter and store it. Until it does, the link still works, the click is still
recorded on Arena's side, and nothing is lost.

---

## 7. Sign in with Google

The code has been there since phase 1 and needs no change: the button, the
OAuth handshake, the callback that swaps the code for a session, and the
profile trigger, which already reads Google's `full_name`, `name` and
`avatar_url`, so a Google account arrives with its real name and picture
rather than an email stub.

What is missing is the configuration, in three places, in this order.

### 7a. Google Cloud Console

**console.cloud.google.com**, on **a Google Cloud project of Arena's own**.

Make a new one rather than using Lab's. This is the same rule the Stripe
account gets further up, for the same reason, and it is easier to get wrong
here: Lab's project is already in the picker, creating a client inside it
takes one click, and nothing warns you.

What goes wrong if you do is not subtle. A Google Cloud project has exactly
one consent screen, and the consent screen is what the person signing in
reads. Arena's players would get **Upside Lab**, with Lab's logo and a link
to `upsidelab.app`, while signing into a stock-picking game. It cannot be
fixed by renaming, because Lab is using it. One consent screen per product is
what they are for.

First **APIs and services, OAuth consent screen**:

- User type **External**, unless everyone signing in has an account on your
  Google Workspace, which they will not.
- App name `Upside Arena`, your support email.
- Application home page `https://upsidearena.com`, privacy policy
  `https://upsidearena.com/legal/privacy`, terms
  `https://upsidearena.com/legal/terms`. All three are real pages. They are
  optional now and required whenever the app goes for verification, so there
  is no reason to leave them empty.
- Authorised domain `upsidearena.com`. The bare domain, no scheme.
- Scopes: the default `email`, `profile` and `openid`. Nothing else. Asking
  for more turns a one-tap sign-in into a permissions dialogue people back
  out of, and Arena has no use for anything further.
- **Publish** it, on the Audience page. While it is in Testing only accounts
  you list by hand can sign in, and everyone else gets an error that reads
  like a broken site.

**Leave the logo empty to begin with.** With no logo and only those three
scopes, publishing needs no Google review and takes effect at once. Upload a
logo and the app has to be verified before it can leave Testing, which takes
days. So publish bare, get sign-in working, then add
`public/icons/consent-120.png` and let verification run while everything
already works. That file is generated by `npm run icons` at the size and
shape Google's dialogue wants, so it does not need making by hand.

Then **Credentials, Create credentials, OAuth client ID**:

- Application type **Web application**.
- Authorised JavaScript origins: `https://upsidearena.com`.
- Authorised redirect URIs, both:
  - `https://upsidearena.com/auth/google/callback`
  - `http://localhost:3000/auth/google/callback`

**Those point at Arena, not at Supabase, and that is the whole reason this
works the way it does.** Supabase will happily run the handshake for us, and
doing it that way is one line of code. What it costs is what the person
signing in reads: Google names an app after the domain it is returning the
browser to, so with Supabase's own callback the consent screen says
`<project>.supabase.co`, and it puts that hostname on the privacy policy and
terms links too. The App name on the consent screen does not override it. The
only other way out is Supabase's paid custom domain add-on.

So Arena takes the redirect itself, exchanges the code server side, and hands
the resulting identity token to Supabase, which verifies it and issues the
session exactly as before. See `src/lib/auth/google.ts`.

Copy the **Client ID** and **Client secret**.

### 7b. Supabase

**Authentication, Providers, Google.** Enable it, paste the client ID and
secret, save.

Both are still needed here even though Arena runs the handshake: Supabase
checks that the identity token it is given was issued for this client id
before it will trust it.

Then **Authentication, URL Configuration**, and check the redirect allow list
contains `https://upsidearena.com/auth/callback`. That is where Arena asks
Supabase to send people once the exchange is done, and Supabase refuses any
destination not on the list. It should already be there from the domain setup.

### 7c. Vercel, and a redeploy

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the client id from 7a |
| `GOOGLE_CLIENT_SECRET` | the client secret from 7a |

Both server only. There is deliberately no separate on switch: the button
appears when Arena holds the credentials to complete a sign-in, because a
switch saying a button should exist is not the same as being able to sign
anybody in, and a button that can only fail is worse than no button.

**Setting them is not enough on its own.** Environment variables are read when
a build runs, so changing them in the dashboard does nothing until the next
deploy. Redeploy after saving.

### 7d. Confirm it worked

1. Open `https://upsidearena.com` signed out. There should be a **Continue
   with Google** button above the email field.
2. Press it. Google should ask which account, because Arena sends
   `prompt=select_account` rather than silently reusing whichever one the
   browser last used. **The screen should say `upsidearena.com`.** If it names
   a `supabase.co` host, the redirect URI in 7a is pointing at Supabase rather
   than at Arena.
3. You should land back on Arena, signed in, and go through onboarding.
4. Check the profile page carries your Google name and picture.

### One thing worth knowing about existing accounts

Somebody who already signed in with an email link, and then signs in with a
Google account on the same address, gets the same Arena account rather than a
second one, because Supabase links identities on a verified email. Their
portfolio, leagues and streak are all still theirs. This is the behaviour you
want, and it is worth knowing before somebody reports it as a bug.

---

## What is already set up in live

Recorded so nobody has to reconstruct it from the dashboard.

### The schema

`0001` to `0013` applied to the Arena Supabase project, `0011` to `0013` on
2026-08-22. To check rather than trust this line: open `/season` signed in and
see whether it names the current quarter.

### Arena

| | |
|---|---|
| Product | `prod_V7DVO5SBjpEe8W`, Upside Arena Plus |
| Price, monthly | `price_1U6z460X9LyRmQJ8fJ1hM9zv`, EUR 2.99 a month |
| Price, yearly | not made yet. Add it per 5c, then set `STRIPE_PLUS_YEARLY_PRICE_ID`. Until then `/plus` shows the monthly price alone, with no picker |
| Webhook | `https://upsidearena.com/api/stripe/webhook`, five events |
| Portal | `bpc_1U6zpm0X9LyRmQJ8WC43tQkK`, named by `STRIPE_PORTAL_CONFIGURATION_ID` |

Coin bundle prices are not in Stripe. They are in `src/lib/billing/plan.ts`,
because the bundle a browser asks for has to be checked against a list the
server controls.

### The account is shared with Upside Lab

Both products bill through one Stripe account, which is correct: they are one
company. Three things are shared, and each is handled so that changing one
product cannot disturb the other.

**The default tax behaviour** is `inferred_by_currency`, which for euro means
inclusive. Arena's coin bundles set `tax_behavior` to inclusive explicitly in
code, so they do not depend on it. The subscription price still relies on the
inference. Pinning that price to inclusive in the dashboard would remove the
last dependency on an account-wide setting Lab shares. It is a one-way change
on that price, and until it is made, anyone changing the account default
silently changes what Arena's subscribers are charged.

**The customer portal** has one default configuration per account, and
whichever product does not name its own inherits it. Arena names its own.
There is also a Lab-branded configuration, `bpc_1U6zpT0X9LyRmQJ8XwgF2VJL`,
which is not in use: Lab still falls through to the account default. Adopting
it is a one-line change on Lab's side, passing `configuration` when it opens a
portal session. The account default allows cancellation at the end of the
period, so Lab's cancel flow is compliant either way; adopting the
configuration would only make it say Upside Lab and return to the right place.

**Webhooks** are per URL and do not overlap.
