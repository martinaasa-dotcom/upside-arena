#!/usr/bin/env bash
#
# The migration checker, checked.
#
# scripts/migrate.sh --check is the thing that would have said "production is
# five migrations behind" months before anybody noticed, so it is worth rather
# more than a guess. It got three answers wrong while it was being written,
# each one plausible:
#
#   it read 0026 as applied, because score_cycle has existed since 0003
#   it read four applied migrations as missing, because later ones replaced
#     their functions with different signatures
#   it read 0026 as superseded, because 0026 drops score_cycle's old overload
#     in the same file that creates the new one
#
# The last of those is the dangerous one: "superseded" reads as nothing to do,
# about the migration whose absence stops every week in the game from
# settling. So this builds two databases whose state is known exactly and
# holds the checker to both answers.
#
#   ./scripts/test-migration-state.sh

set -euo pipefail

PSQL="${PSQL:-psql}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

inventory() {
  $PSQL -tAX -d "$1" -c "
    select coalesce(string_agg(line, ' '), '') from (
      select 'table:' || table_name as line
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      union all
      select 'function:' || p.proname || ':' || p.pronargs
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
      union all
      select 'body:' || p.proname || ':' || p.pronargs || ':' || md5(p.prosrc)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    ) everything;"
}

# Builds a database with every migration up to and including $2.
build() {
  $PSQL -q -c "drop database if exists $1;" -c "create database $1;" > /dev/null
  $PSQL -q -d "$1" -f "$ROOT/supabase/tests/shim.sql" > /dev/null 2>&1
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    local number
    number="$(basename "$migration" | cut -c1-4)"
    if [ "$number" -le "$2" ] 2>/dev/null; then
      $PSQL -q -d "$1" -v ON_ERROR_STOP=1 -f "$migration" > /dev/null
    fi
  done
}

state() {
  inventory "$1" | python3 "$ROOT/scripts/migration-state.py" "$ROOT/supabase/migrations"
}

fail() {
  echo "FAILED: $1" >&2
  exit 1
}

# The newest migration there is, so this needs no editing when one is added.
NEWEST="$(basename "$(ls "$ROOT"/supabase/migrations/*.sql | sort | tail -1)" | cut -c1-4)"
PREVIOUS="$(basename "$(ls "$ROOT"/supabase/migrations/*.sql | sort | tail -2 | head -1)" | cut -c1-4)"

echo "== a database with every migration says nothing is missing"
build arena_state_all "$NEWEST"
UP_TO_DATE="$(state arena_state_all)"
grep -q "^Nothing missing.$" <<< "$UP_TO_DATE" ||
  fail "a fully migrated database reported work to do:"$'\n'"$UP_TO_DATE"
grep -q "MISSING" <<< "$UP_TO_DATE" &&
  fail "a fully migrated database reported something missing"
echo "ok"

echo
echo "== a database one migration short says exactly which one"
build arena_state_behind "$PREVIOUS"
BEHIND="$(state arena_state_behind)"
grep -q "^1 missing" <<< "$BEHIND" ||
  fail "a database one migration short did not report one missing:"$'\n'"$BEHIND"
grep -qE "^  0*$NEWEST.* MISSING" <<< "$BEHIND" ||
  fail "the missing migration was not the newest one:"$'\n'"$BEHIND"
echo "ok"

echo
echo "== the report and the list --all applies say the same thing"
# --all applies what --names-only prints while the reader is looking at what
# the report printed. If those two ever disagree, the tool applies something
# other than what it just said it would.
REPORTED="$(state arena_state_behind | grep -oE '^  [0-9]{4}_[a-z_]+' | sed 's/^  //' ; true)"
LISTED="$(inventory arena_state_behind |
  python3 "$ROOT/scripts/migration-state.py" "$ROOT/supabase/migrations" --names-only)"
REPORTED_MISSING="$(state arena_state_behind | grep 'MISSING' | grep -oE '[0-9]{4}_[a-z_]+' | head -1)"

[ "$LISTED" = "$REPORTED_MISSING" ] ||
  fail "the report says '$REPORTED_MISSING' and --all would apply '$LISTED'"
echo "ok"

echo
echo "Migration state checker passed."
