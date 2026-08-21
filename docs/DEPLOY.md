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

## Plan limits worth knowing

The team is on Vercel's **Hobby** plan today. Two consequences:

- Hobby is for non-commercial use. Arena is free with no ads, so it fits for
  now. Phase 8 adds payments, which does not, and will need Pro.
- **Hobby cron jobs run once a day at an hour Vercel chooses.** Phase 3 needs
  the week to roll over and score at Friday's close, at a known time. That
  needs Pro. `score_cycle` is idempotent so a retry is always safe, but the
  clean answer is the plan upgrade.

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
