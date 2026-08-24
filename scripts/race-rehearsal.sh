#!/usr/bin/env bash
#
# Two people at once.
#
# Every other test in supabase/tests runs in one session, which is the one
# shape that cannot catch the bugs this file is about. A conditional update and
# a row lock are either correct or they are silently not, and reading them is
# not the same as racing them: a claim that is wrong looks exactly like a claim
# that is right, right up until two servers notice the same finished week in
# the same millisecond, which on a Friday evening they do.
#
# THE STARTING GUN IS THE WHOLE TEST, AND THE FIRST VERSION OF THIS FILE HAD
# NONE.
#
# It launched sixteen psql processes with `&` and waited. That looks like a
# race and is not: a psql process takes tens of milliseconds to start and
# connect, so the sixteen arrived in single file and nothing ever overlapped.
# Every assertion passed, and would have passed against almost any code at all.
#
# So the racers now queue on a shared advisory lock that a coordinator session
# holds exclusively. Each one connects, blocks, and waits. Only once all
# sixteen are confirmed waiting in pg_locks does the coordinator let go, and
# they enter the critical section together. If they are not all at the line,
# fire_gun fails rather than pretending a race happened.
#
# WHAT IT CATCHES, MEASURED RATHER THAN ASSUMED.
#
# Replace claim_cycle_for_scoring's conditional update with the read-then-write
# it would be natural to write instead -- check whether the week is claimable,
# then claim it -- and this file fails with "15 of 16 claimed the week". That
# is the bug it exists for, and it is the worst one available here: fifteen
# servers scoring one week at once.
#
# WHAT IT DOES NOT CATCH, WHICH IS WORTH KNOWING BEFORE TRUSTING IT.
#
# Two mutations to execute_trade were tried and both still pass: taking the
# `for update` off the portfolio read, and changing `set cash = cash - gross`
# to write an absolute value computed from the earlier read. Neither breaks
# the money, because two other things are load-bearing underneath: the
# holdings row is also taken `for update`, which puts the buyers into single
# file before any of them spends anything, and portfolios_cash_not_negative
# would refuse an overdraft even if one got that far. So do not read a pass
# here as proof that execute_trade's locking is right. It is proof that no
# money was spent twice, that exactly ten thousand dollars bought exactly ten
# lots of a thousand, and that sixteen tabs make one portfolio.
#
# Three races, each one a thing a player could actually cause:
#
#   two servers noticing a finished week at the same moment
#   one player's browser sending the same buy twice
#   two requests creating this week's portfolio for the same person
#
#   ./scripts/race-rehearsal.sh
#
# Set PSQL to override how psql is invoked.

set -euo pipefail

PSQL="${PSQL:-psql}"
DB="${ARENA_RACE_DB:-arena_race}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNERS=16

# The advisory key the starting gun is held on. Arbitrary, and nothing else in
# the schema takes an advisory lock, so it cannot collide.
GUN=424242

run() {
  $PSQL -q -d "$DB" -v ON_ERROR_STOP=1 -f "$1"
}

q() {
  $PSQL -tAX -d "$DB" -c "$1"
}

fail() {
  echo "FAILED: $1" >&2
  exit 1
}

ok() {
  echo "ok: $1"
}

COORD_FIFO=""
COORD_PID=""

cleanup() {
  [ -n "$COORD_PID" ] && kill "$COORD_PID" 2>/dev/null || true
  [ -n "$COORD_FIFO" ] && rm -f "$COORD_FIFO" || true
}
trap cleanup EXIT

# Takes the gun and holds it until released. A session-level lock, so it
# survives the statement that took it.
raise_gun() {
  COORD_FIFO="$(mktemp -u)"
  mkfifo "$COORD_FIFO"
  $PSQL -q -d "$DB" -f "$COORD_FIFO" > /dev/null 2>&1 &
  COORD_PID=$!
  exec 9> "$COORD_FIFO"
  echo "select pg_advisory_lock($GUN);" >&9

  for _ in $(seq 100); do
    held=$(q "select count(*) from pg_locks
              where locktype = 'advisory' and objid = $GUN and granted;")
    [ "$held" -ge 1 ] && return 0
    $PSQL -tAX -d "$DB" -c "select pg_sleep(0.05);" > /dev/null
  done
  fail "the coordinator never took the starting gun"
}

# Waits until every racer is queued behind it, then lets go. If they are not
# all waiting, they are not racing, and this refuses to pretend otherwise.
fire_gun() {
  for _ in $(seq 200); do
    waiting=$(q "select count(*) from pg_locks
                 where locktype = 'advisory' and objid = $GUN and not granted;")
    [ "$waiting" -ge "$RUNNERS" ] && break
    $PSQL -tAX -d "$DB" -c "select pg_sleep(0.05);" > /dev/null
  done
  [ "$waiting" -ge "$RUNNERS" ] ||
    fail "only $waiting of $RUNNERS racers reached the line, so nothing raced"

  echo "select pg_advisory_unlock($GUN);" >&9
  exec 9>&-
  wait "$COORD_PID" 2>/dev/null || true
  COORD_PID=""
}

# One racer: queue on the gun, and the moment it goes, do the thing.
racer() {
  $PSQL -tAX -d "$DB" -c "
    select pg_advisory_lock_shared($GUN);
    select pg_advisory_unlock_shared($GUN);
    $1
  " > /dev/null 2>&1 || true
}

echo "== building $DB from the migrations"
$PSQL -q -c "drop database if exists $DB;" -c "create database $DB;"
run "$ROOT/supabase/tests/shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  run "$migration"
done

WHO='00000000-0000-4000-8000-000000000001'
CYCLE='00000000-0000-4000-9000-000000000001'

$PSQL -q -d "$DB" -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (id, email) values ('$WHO', 'racer@example.com');
insert into public.weekly_cycles (id, monday, status, benchmark_open, starting_balance)
values ('$CYCLE', '2026-06-08', 'open', 500, 100000);
SQL

# ---------------------------------------------------------------------------
# Two servers notice the same finished week
# ---------------------------------------------------------------------------
# The claim is a conditional update rather than a read followed by a write,
# so the loser's WHERE is re-evaluated after the winner commits and matches
# nothing. Scoring is idempotent anyway, which is the second line of defence
# and not a reason to skip the first.

echo
echo "== $RUNNERS servers claim one week at once"
raise_gun
CLAIMED_FILE="$(mktemp)"
for _ in $(seq "$RUNNERS"); do
  (
    $PSQL -tAX -d "$DB" -c "
      select pg_advisory_lock_shared($GUN);
      select pg_advisory_unlock_shared($GUN);
      select public.claim_cycle_for_scoring('$CYCLE');
    " 2>/dev/null | tail -1 >> "$CLAIMED_FILE"
  ) &
done
fire_gun
wait

WON=$(grep -c '^t$' "$CLAIMED_FILE" || true)
rm -f "$CLAIMED_FILE"
[ "$WON" -eq 1 ] || fail "$WON of $RUNNERS claimed the week, and exactly one may"
ok "exactly one of $RUNNERS claims the week"

$PSQL -q -d "$DB" -c "update public.weekly_cycles set status = 'open' where id = '$CYCLE';"

# ---------------------------------------------------------------------------
# The same buy, sent at the same moment
# ---------------------------------------------------------------------------
# The portfolio row is taken `for update` before the cash is read, so the
# second request reads the balance the first one left rather than the one it
# started with. Without that lock both would see the opening balance, both
# would pass the affordability check, and the account would be overdrawn --
# which the cash check constraint would then refuse, but only after one of
# them had already been told their order went through.

$PSQL -q -d "$DB" -c "select public.ensure_portfolio('$WHO', '$CYCLE');" > /dev/null
$PSQL -q -d "$DB" -c "update public.portfolios set cash = 10000 where user_id = '$WHO';"

echo
echo "== $RUNNERS copies of one buy, and only ten are affordable"
raise_gun
for _ in $(seq "$RUNNERS"); do
  # 10 shares at $100 is $1,000, so exactly ten of these fit in $10,000.
  # p_max_per_minute is lifted, since this is testing the lock and not the
  # anti-cheat limit that sits in front of it.
  racer "select public.execute_trade('$WHO', '$CYCLE', 'AAPL', 'buy', 10, 100, 1000, 1000);" &
done
fire_gun
wait

CASH=$(q "select cash from public.portfolios where user_id = '$WHO';")
FILLED=$(q "select count(*) from public.trades;")
# Share counts are numeric, so they come back as 100.0000. Compared in the
# database rather than parsed here.
SHARES_OK=$(q "select coalesce(sum(quantity), 0) = 100 from public.holdings;")
SHARES=$(q "select coalesce(sum(quantity), 0)::integer from public.holdings;")

[ "$FILLED" -eq 10 ] || fail "$FILLED trades filled out of \$10,000, and ten fit"
ok "exactly ten of $RUNNERS fill"

# 0.00, never below. A negative balance is refused by a check constraint, so
# the interesting failure is not a negative number: it is money that was spent
# twice and a fill somebody was told about that the database then threw away.
NEGATIVE=$(q "select cash < 0 from public.portfolios where user_id = '$WHO';")
[ "$NEGATIVE" = "f" ] || fail "cash went to $CASH"
ok "cash lands at $CASH and never below nought"

[ "$SHARES_OK" = "t" ] || fail "$SHARES shares held, and ten fills of ten is a hundred"
ok "the holding matches the fills: $SHARES shares"

# ---------------------------------------------------------------------------
# Two requests, one week, one person
# ---------------------------------------------------------------------------
# A page render creates this week's portfolio if it is missing, and a person
# opening two tabs does that twice at once. The unique on (user_id, cycle_id)
# is what makes the loser return the winner's row instead of a second
# portfolio, which would be a second hundred thousand dollars.

$PSQL -q -d "$DB" -c "delete from public.portfolios where user_id = '$WHO';"

echo
echo "== $RUNNERS tabs open the same week"
raise_gun
for _ in $(seq "$RUNNERS"); do
  racer "select public.ensure_portfolio('$WHO', '$CYCLE');" &
done
fire_gun
wait

MADE=$(q "select count(*) from public.portfolios where user_id = '$WHO';")
[ "$MADE" -eq 1 ] || fail "$MADE portfolios for one person in one week"
ok "one person in one week has one portfolio"

echo
echo "Race rehearsal passed."
