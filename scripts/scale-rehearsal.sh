#!/usr/bin/env bash
#
# A launch morning, rehearsed.
#
# Builds a database from the migrations, fills it with a launch's worth of
# players, weeks, leagues and holdings, and then runs the query every room
# really runs against it -- checking that none of them reads a whole table and
# that none of them takes an order of magnitude longer than it should.
#
# It needs no production credentials and no hosted project, so it runs on
# every pull request rather than once, by hand, after somebody complains that
# a page is slow.
#
#   ./scripts/scale-rehearsal.sh
#
# Set PSQL to override how psql is invoked, for example:
#   PSQL="sudo -u postgres psql" ./scripts/scale-rehearsal.sh

set -euo pipefail

PSQL="${PSQL:-psql}"
DB="${ARENA_SCALE_DB:-arena_scale}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run() {
  $PSQL -q -d "$DB" -v ON_ERROR_STOP=1 -f "$1"
}

echo "== building $DB from the migrations"
$PSQL -q -c "drop database if exists $DB;" -c "create database $DB;"
run "$ROOT/supabase/tests/shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  run "$migration"
done
run "$ROOT/supabase/tests/helpers.sql"

echo "== seeding a launch morning"
$PSQL -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/scale/seed.sql"

echo
echo "== measuring the rooms"
# Notices carry the timings, and psql sends those to stderr.
$PSQL -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/scale/measure.sql" 2>&1 |
  sed -e 's/^psql:[^ ]*: NOTICE:  //' -e '/^NOTICE:  /s/^NOTICE:  //'
