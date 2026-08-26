# Every screen, and how somebody gets to it

The audit asks for a sitemap with no orphans on it. This is it: every route
the app serves, what it is, and the way in. Anything with no way in is a
screen nobody will ever see, and there are four of those here on purpose.

## Signed out

| Route | What it is | How you get there |
|---|---|---|
| `/` | The product page and the sign-in button | The domain |
| `/how` | How the game works, in ten sections | Linked from `/`, from the footer, and from the walkthrough. Needs no account |
| `/legal/terms` | Terms | Footer, and beside every sign-in button |
| `/legal/privacy` | Privacy policy | Footer, and beside every sign-in button |
| `/w/[token]` | Somebody's shared week | The link they sent. Deliberately unlinked from anywhere in the app |
| `/auth/error` | Sign-in did not finish, and why | Redirected to by the Google callback |
| `/offline` | The page the service worker falls back to | Served by `public/sw.js` when the network is gone. Never linked |

## Signed in

Four of these are the dock, in this order, and the dock is on every room in
the group. Season is deliberately not one of them: every figure in it was
settled on a Friday and cannot change mid-week, so it is a record rather than
a room and it lives on Profile with the rest of a player's record.

| Route | What it is | How you get there |
|---|---|---|
| `/home` | The week: your figures, what moved, your leagues | Dock, and where sign-in lands |
| `/trade` | Buying and selling, and the weekend lineup | Dock |
| `/leagues` | The leagues you are in, and joining one | Dock |
| `/leagues/[id]` | One league: standings, goals, battles, invite | The list at `/leagues` |
| `/leagues/[id]/battle` | The league's current contest | The league page, and a card on Home |
| `/leagues/[id]/draft` | Draft night: picking a battle's holdings in turn, off one board | The league page, while a draft is open. A drafted battle's own route redirects here until it has been bought |
| `/leagues/[id]/record` | What that league has done over time | The league page |
| `/season` | The quarter's table | Profile, which lists every quarter you have played |
| `/profile` | Your record, wardrobe, addresses, notifications, account | Dock |
| `/plus` | What a subscription is and what it costs | Profile, and the limit messages that mention it |
| `/onboarding` | Player tag and the age gate | Redirected to after a first sign-in, and by any room until it is done |

## Not for players

| Route | What it is | How you get there |
|---|---|---|
| `/metrics` | The four numbers the loop is tuned by | Typed. It is owner only and 404s for everybody else, because a page that says "you are not allowed" tells a stranger it exists |
| `/gallery` | Every component, in every state, at every width | Typed, and only when `ARENA_UI_GALLERY=1`. It is what the clipping and accessibility suites measure, and it 404s in production |

## Machines

| Route | Who calls it |
|---|---|
| `/api/health` | The half-hourly workflow in `.github/workflows/health.yml`, and anything else that wants to know. Public and says nothing about anybody |
| `/api/cron/settle` | The settle workflow, with the shared secret |
| `/api/cron/notify` | The trading day pass, with the shared secret |
| `/api/stripe/webhook` | Stripe, which signs the body |
| `/api/unsubscribe` | A mail client, or the link at the foot of an email |
| `/api/account/export` | The download button on the profile page |
| `/api/error` | The error boundaries, when a screen will not draw |
| `/api/push/resubscribe` | The service worker, when a push subscription is replaced |
| `/auth/callback`, `/auth/google/callback` | Google, and Supabase's own token exchange |

## The four with no way in, and why

- `/w/[token]` is a link somebody chose to send. Putting it in the app would
  mean listing other people's shared weeks, which is the opposite of what
  sharing one is.
- `/offline` is for the moment there is no network to follow a link over.
- `/metrics` and `/gallery` are not players' screens, and both are gated
  rather than hidden: the first checks the email against `ARENA_ADMIN_EMAILS`,
  the second checks an environment variable that no deployment sets.

Everything else on this page is reachable in two taps from the dock, which is
the whole of the navigation and is deliberately four things.
