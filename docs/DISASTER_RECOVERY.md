# If the worst happens

What Arena would lose, what it would not, and exactly how to get it back.

Nothing in here needs a paid service. A backup is a file, `pg_dump` writes it,
`gpg` locks it and GitHub keeps it, and the whole of the recovery below has
been rehearsed rather than reasoned about: `scripts/restore-rehearsal.sh` runs
on every pull request and fails the build if a backup cannot be restored.

## What is actually at risk

Arena's database holds two kinds of thing, and only one of them is a
catastrophe.

**Cannot be recreated.** Who somebody is (`auth.users`, `profiles`), what they
did (`trades`, `holdings`, `portfolios`), who they play with (`leagues`,
`league_members`, `pods`), what they have earned (`streaks`, `user_rewards`,
`season_results`) and what they have paid for (`entitlements`). A trade
happened at a price on a Tuesday and there is no way to work that out
afterwards.

**Can be recreated.** Every price. Quotes are fetched, cached for a minute and
never stored; opening and closing prices come from the chart endpoint and can
be asked for again for any day in the past. A week that lost its
`benchmark_open` can settle from the same request that filled it in the first
place, which is why `settleCycle` asks again rather than giving up.

**Can be recomputed, given the above.** Standings, season tables, records and
the daily marks. The marks are the one awkward case: they are a portfolio's
value at each day's close, and rebuilding one needs both that day's closing
prices, which are still available, and the holdings as they stood that
evening, which are not. A restore that loses a day of marks loses the shape of
that week on a share card and nothing else.

## The backups

**Nightly, ours.** `.github/workflows/backup.yml` runs at 05:00 UTC, calls
`scripts/backup.sh` and keeps the result as an encrypted artifact of the run
for ninety days. It writes two files:

| File | What it holds |
|---|---|
| `arena-<when>-public.dump.gpg` | The whole `public` schema, structure and data, in pg_dump's custom format so a single table can be restored on its own. |
| `arena-<when>-auth.sql.gpg` | `auth.users` and `auth.identities`, data only, one INSERT per row. |

The second file is not optional and the reason is worth knowing: every row in
`public` that belongs to somebody points at `auth.users`, which is Supabase's
table rather than Arena's. Restore the public schema on its own into a fresh
project and it cannot even build its foreign keys.

Two secrets make it work, both set by hand under Settings, Secrets and
variables, Actions:

| Secret | Where it comes from |
|---|---|
| `SUPABASE_DB_URL` | Supabase, Settings, Database, the **direct** connection string. The pooler will not do for `pg_dump`. |
| `BACKUP_PASSPHRASE` | A long random string you generate. **Keep a copy somewhere that is not this repository**, because a passphrase stored beside the thing it encrypts is not a passphrase. |

Without either, the workflow fails loudly rather than quietly writing nothing,
and a failed scheduled workflow is what mails you.

**Whatever the Supabase plan gives.** Check the project's Backups page. If the
plan includes daily backups or point in time recovery, that is the faster way
back and the one to reach for first; the nightly artifact is what exists
regardless of plan, and it is the one that survives losing access to the
Supabase account itself.

## Getting it back

Restoring into a fresh Supabase project, which is the worst case and therefore
the one written down:

1. **Make the project.** Note its URL and its keys. Nothing else about it
   matters yet.
2. **Take the backup out of GitHub.** The run's artifact, downloaded and
   unzipped. Decrypt with the passphrase:
   `gpg --decrypt arena-...-public.dump.gpg > public.dump`
3. **Put the people back first.**
   `gpg --decrypt arena-...-auth.sql.gpg | psql "$DATABASE_URL"`
   Supabase has already built the `auth` schema; this is data going into it.
4. **Then the game.**
   `pg_restore --no-owner --no-privileges --dbname "$DATABASE_URL" public.dump`
   One error about the `public` schema existing already is expected, because
   the project has one. Anything else means the restore did not finish, and a
   half-restored database that reports success is the failure this whole file
   exists to avoid.
5. **Check the joins, not the row counts.** A portfolio whose owner is missing
   is a restore that looks complete and is not:
   ```sql
   select count(*) from public.portfolios p
   where not exists (select 1 from auth.users u where u.id = p.user_id);
   ```
   It has to be zero. The rehearsal asks exactly this question.
6. **Point Arena at it.** Update `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel
   and redeploy. See [DEPLOY.md](DEPLOY.md).
7. **Let it catch up.** Any week that finished while the app was down settles
   on the first request that notices, and `/api/health` says so if one is
   stuck.

## Rehearsing it

```
./scripts/restore-rehearsal.sh
```

Builds a database from the migrations, puts a trade in it, backs it up with
the same script the nightly workflow runs, restores that backup into an empty
database, and checks that the trade, the cash and the person it belongs to all
came back. It needs a local Postgres and no production credentials, which is
why it runs on every pull request rather than once a year in an emergency.

## When it is not the data

**A deploy broke something.** Vercel keeps every previous deployment. Promote
the last good one from the project's Deployments page; it is live in seconds
and nothing about the database changes. Migrations are written to be additive
for this reason: a rolled-back build talks to a schema slightly newer than it
expects, which is survivable, while a schema rolled back under a running build
is not.

**The service role key leaked.** Rotate it in Supabase and update it in
Vercel. Nothing else has to change: it is the key the server writes the game
with, and no player ever holds it.

**The market data provider is down.** Nothing to recover. Quotes fall back to
the last known price and say so, a week refuses to settle rather than settling
on a guess, and `/api/health` reports it.

**A week settled on a wrong number.** Scoring is idempotent but it is also
final: `score_cycle` writes a result and closes the week. Re-running it needs
the week reopened by hand, which is a deliberate decision made with the
numbers in front of you, not a script.
