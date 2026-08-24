#!/usr/bin/env bash
#
# What the project has, and applying what it does not.
#
# A deploy and a migration are two separate acts, and this repository has
# already been bitten by the gap: production sat at 0025 for five migrations
# while main carried the code that needs them, and nothing anywhere said so.
# The app cannot tell you, because a missing migration mostly degrades
# quietly.
#
#   ./scripts/migrate.sh --check           what production has and has not
#   ./scripts/migrate.sh 0026 0027         apply those, in order, one at a time
#   ./scripts/migrate.sh --all             apply everything --check says is missing
#
# Needs SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN. The access token is a
# personal token (sbp_...) from Account -> Access Tokens, and it is NOT the
# service role key: that one authenticates against PostgREST, which reads and
# writes rows, and cannot express `create function` at all.
#
# The Management API is used rather than psql because it works over nothing
# but HTTPS, which is the only thing open from some of the places this gets
# run. docs/DEPLOY.md has the long version.
#
# WHICH MIGRATIONS ARE APPLIED IS DERIVED, NOT RECORDED.
#
# There is no ledger table, deliberately: one more thing to keep in step, and
# it lies the first time somebody runs a file by hand in the SQL editor. So
# each migration is judged by whether the things it creates are there, read
# out of the file itself.
#
# A function is matched on its name AND its parameter count, which is not
# fussiness. 0026 is a `create or replace function score_cycle`, and
# score_cycle has existed since 0003: on the name alone this would have said
# "applied" about the one migration whose absence stops every week in the game
# from settling.
#
# What it cannot see is a migration that only rewrites the body of an existing
# function without changing its shape. Nothing here is that today, and a
# migration that is should say so in its own header rather than trusting this.
#
# The failure mode is the safe one either way: a partly applied migration
# reads as missing, and every migration here is written to be safe to run
# twice.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="https://api.supabase.com/v1/projects"

: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF to the project you mean}"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN to a personal token (sbp_...)}"

# Runs one statement and prints the raw JSON answer.
ask() {
  local payload
  payload="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$1")"
  curl -sS -X POST \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "$API/$SUPABASE_PROJECT_REF/database/query" \
    --data "$payload"
}

# Everything the project has, fetched once.
#
# The first version of this asked one question per object, which is sixty
# round trips to answer one question and slow enough to look hung. The set of
# tables and functions in a schema is small; fetch it whole and let
# scripts/migration-state.py do the judging.
inventory() {
  ask "
    select coalesce(string_agg(line, ' '), '') as have from (
      select 'table:' || table_name as line
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      union all
      select 'function:' || p.proname || ':' || p.pronargs
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    ) everything;" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["have"])'
}

check() {
  echo "project: $SUPABASE_PROJECT_REF"
  echo
  local have
  have="$(inventory)"
  [ -n "$have" ] || { echo "could not read the project's schema"; exit 1; }
  printf '%s' "$have" |
    python3 "$ROOT/scripts/migration-state.py" "$ROOT/supabase/migrations"
}

apply_one() {
  local file="$1" name payload code
  name="$(basename "$file" .sql)"

  payload="$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$file")"
  code=$(curl -sS -o /tmp/migrate-answer.json -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "$API/$SUPABASE_PROJECT_REF/database/query" \
    --data "$payload")

  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    printf '  %-62s %s\n' "$name" "applied"
  else
    printf '  %-62s %s\n' "$name" "FAILED ($code)"
    head -c 600 /tmp/migrate-answer.json
    echo
    # One at a time and stop on the first failure: the later ones assume the
    # earlier ones, so carrying on turns one clear error into five confusing
    # ones.
    exit 1
  fi
}

case "${1:-}" in
  --check)
    check
    ;;
  --all)
    check
    mapfile -t behind < <(grep -v '^$' "$ROOT/.migrate-behind" || true)
    [ ${#behind[@]} -eq 0 ] && exit 0
    echo
    echo "applying ${#behind[@]}:"
    for name in "${behind[@]}"; do apply_one "$ROOT/supabase/migrations/$name.sql"; done
    echo
    check
    ;;
  "")
    sed -n '2,30p' "$0" | sed 's/^#\s\?//'
    exit 1
    ;;
  *)
    echo "applying $#:"
    for want in "$@"; do
      file=$(ls "$ROOT"/supabase/migrations/"$want"*.sql 2>/dev/null | head -1)
      [ -n "$file" ] || { echo "no migration matching $want"; exit 1; }
      apply_one "$file"
    done
    echo
    check
    ;;
esac
