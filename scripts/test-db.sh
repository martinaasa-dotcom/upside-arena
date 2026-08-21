#!/usr/bin/env bash
#
# Tests the migrations, their triggers and their row level security against a
# plain Postgres. No Docker and no hosted project needed, so the rules that
# protect the game can be checked anywhere.
#
#   ./scripts/test-db.sh
#
# Set PSQL to override how psql is invoked, for example:
#   PSQL="sudo -u postgres psql" ./scripts/test-db.sh

set -euo pipefail

PSQL="${PSQL:-psql}"
DB="${ARENA_TEST_DB:-arena_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run() {
  $PSQL -q -d "$DB" -v ON_ERROR_STOP=1 -f "$1"
}

# Each suite gets a database of its own. Sharing one lets a suite that seeds
# players change what the next suite counts, which turns a passing test red
# for a reason that has nothing to do with the code.
prepare() {
  $PSQL -q -c "drop database if exists $DB;" -c "create database $DB;"
  run "$ROOT/supabase/tests/shim.sql"
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    run "$migration"
  done
  run "$ROOT/supabase/tests/helpers.sql"
}

for suite in "$ROOT"/supabase/tests/*.test.sql; do
  echo "== $(basename "$suite")"
  prepare
  run "$suite"
done

echo
echo "Database tests passed."
