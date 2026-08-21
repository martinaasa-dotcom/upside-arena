#!/usr/bin/env bash
#
# Tests the migration, its triggers and its row level security against a plain
# Postgres. No Docker and no hosted project needed, so the security rules can
# be checked anywhere.
#
#   ./scripts/test-db.sh
#
# Set PSQL to override how psql is invoked, for example:
#   PSQL="sudo -u postgres psql" ./scripts/test-db.sh

set -euo pipefail

PSQL="${PSQL:-psql}"
DB="${ARENA_TEST_DB:-arena_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Rebuilding $DB"
$PSQL -q -c "drop database if exists $DB;" -c "create database $DB;"

run() {
  $PSQL -q -d "$DB" -v ON_ERROR_STOP=1 -f "$1"
}

echo "Applying the Supabase shim"
run "$ROOT/supabase/tests/shim.sql"

echo "Applying migrations"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "  $(basename "$migration")"
  run "$migration"
done

echo "Running tests"
run "$ROOT/supabase/tests/rls.test.sql"

echo
echo "Database tests passed."
