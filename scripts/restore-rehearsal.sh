#!/usr/bin/env bash
#
# Proves the backup can be restored, rather than that a backup exists.
#
#   ./scripts/restore-rehearsal.sh
#
# Builds a database from the migrations, puts something in it, backs it up
# with scripts/backup.sh, restores that backup into an empty database, and
# checks that what comes back is what went in.
#
# It runs against a plain local Postgres, so it needs no production
# credentials and can run on every pull request. What it cannot prove is that
# the nightly workflow is pointed at the right database; what it does prove is
# that the dump, the encryption, the decryption and the restore all work,
# which is every step that has ever failed silently.

set -euo pipefail

PSQL="${PSQL:-psql}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE="${REHEARSAL_DB:-arena_rehearsal}"
COPY="${LIVE}_restored"
WORK="$(mktemp -d)"

trap 'rm -rf "$WORK"' EXIT

export BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-a passphrase for the rehearsal}"

echo "== a database, as the migrations build it"
$PSQL -q -c "drop database if exists $LIVE;" -c "create database $LIVE;"
$PSQL -q -d "$LIVE" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/shim.sql" > /dev/null
for migration in "$ROOT"/supabase/migrations/*.sql; do
  $PSQL -q -d "$LIVE" -v ON_ERROR_STOP=1 -f "$migration" > /dev/null
done

echo "== something in it worth losing"
$PSQL -q -d "$LIVE" -v ON_ERROR_STOP=1 > /dev/null <<'SQL'
insert into auth.users (id, email)
values ('dddd0000-0000-0000-0000-000000000001', 'rehearsal@example.com');

insert into public.weekly_cycles (id, monday, status, starting_balance, benchmark_open)
values ('dddd0000-0000-0000-0000-0000000000aa', '2026-06-08', 'open', 100000, 100);

select public.ensure_portfolio(
  'dddd0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-0000000000aa');

select public.execute_trade(
  'dddd0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-0000000000aa',
  'AAPL', 'buy', 10, 100);
SQL

before=$($PSQL -tA -d "$LIVE" -c "select count(*) from public.trades;")

echo "== backed up"
DATABASE_URL="postgres:///$LIVE" "$ROOT/scripts/backup.sh" "$WORK" > /dev/null
GAME=$(ls "$WORK"/*-public.dump.gpg)
PEOPLE=$(ls "$WORK"/*-auth.sql.gpg)

echo "== restored into an empty database, in the order a real recovery goes"
$PSQL -q -c "drop database if exists $COPY;" -c "create database $COPY;"

# The auth schema first, because it is Supabase's rather than Arena's and in a
# real recovery it is already there before anything of ours is restored. Here
# that is the same stand-in the migrations are tested against.
$PSQL -q -d "$COPY" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/shim.sql" > /dev/null

# Then the people, so that when the game comes back every row it holds has
# somebody to belong to and every foreign key can be built.
gpg --batch --yes --quiet --decrypt --passphrase-fd 3 "$PEOPLE" 3<<< "$BACKUP_PASSPHRASE" \
  | $PSQL -q -d "$COPY" -v ON_ERROR_STOP=1 > /dev/null

# Then the game itself.
restore_log="$WORK/restore.log"
gpg --batch --yes --quiet --decrypt --passphrase-fd 3 "$GAME" 3<<< "$BACKUP_PASSPHRASE" \
  | pg_restore --no-owner --no-privileges --dbname "postgres:///$COPY" \
  > "$restore_log" 2>&1 || true

# Two lines are expected and neither is a problem: the public schema exists
# already because the shim made it, and pg_restore then says it ignored an
# error. Anything else is a restore that did not fully happen, and a
# half-restored database reporting success is the failure this rehearsal is
# about. A real error still shows up as its own line, so dropping the summary
# cannot hide one.
if grep -v "already exists" "$restore_log" \
   | grep -v "errors ignored on restore" \
   | grep -qi "error"; then
  echo "::error::the restore reported errors:"
  cat "$restore_log"
  exit 1
fi

after=$($PSQL -tA -d "$COPY" -c "select count(*) from public.trades;")
cash=$($PSQL -tA -d "$COPY" -c "select cash from public.portfolios limit 1;")
people=$($PSQL -tA -d "$COPY" -c "select count(*) from auth.users;")

echo "== trades before $before, after $after, cash $cash, people $people"

# A portfolio whose owner is missing is a restore that looks complete and is
# not. The foreign key above would have refused to build, which is why the
# restore log is read rather than trusted.
orphans=$($PSQL -tA -d "$COPY" -c "
  select count(*) from public.portfolios p
  where not exists (select 1 from auth.users u where u.id = p.user_id);")

if [ "$orphans" != "0" ] || [ "$people" = "0" ]; then
  echo "::error::the restored database has $orphans portfolios belonging to nobody."
  exit 1
fi

if [ "$before" != "$after" ] || [ "$before" = "0" ]; then
  echo "::error::the restored database does not hold what was backed up."
  exit 1
fi

if [ "${cash%.*}" != "99000" ]; then
  echo "::error::the restored portfolio says $cash, which is not what it was."
  exit 1
fi

$PSQL -q -c "drop database if exists $LIVE;" -c "drop database if exists $COPY;"

echo "== the backup restores, and what comes back is what went in."
