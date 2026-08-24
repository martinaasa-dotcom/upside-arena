#!/usr/bin/env bash
#
# Two encrypted files that together are the whole of Arena's data.
#
#   DATABASE_URL=postgres://... BACKUP_PASSPHRASE=... ./scripts/backup.sh out/
#
# pg_dump and gpg, and nothing else. There is no service to sign up to, no
# agent to install and no bill: a backup is a file, and a backup nobody can
# read without the passphrase is a file that is safe to put anywhere.
#
# Two files rather than one, and the second is not optional.
#
#   The public schema is the game: profiles, weeks, portfolios, trades,
#   leagues, everything. Custom format, so pg_restore can bring back a single
#   table without touching the rest, and with no ownership or grants, because
#   the roles on the machine it is restored onto are never the roles it came
#   from.
#
#   auth.users and auth.identities are who those rows belong to, and they are
#   Supabase's tables rather than Arena's. Without them a restore of the
#   public schema alone cannot even build its foreign keys: every portfolio
#   points at a person who is not there. Data only and one INSERT per row, so
#   it can be loaded into a project whose auth schema is already built and
#   whose columns may not be in the same order.

set -euo pipefail

OUT="${1:-backups}"
: "${DATABASE_URL:?DATABASE_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"

mkdir -p "$OUT"

# Named for the moment it was taken, in UTC, so a listing sorts itself.
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
GAME="$OUT/arena-$STAMP-public.dump.gpg"
PEOPLE="$OUT/arena-$STAMP-auth.sql.gpg"

encrypt() {
  gpg --batch --yes --symmetric --cipher-algo AES256 \
      --passphrase-fd 3 --output "$1" 3<<< "$BACKUP_PASSPHRASE"
}

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --dbname="$DATABASE_URL" \
  | encrypt "$GAME"

# Which of the auth tables this database actually has. A local rehearsal runs
# against a stand-in for Supabase's auth schema that has users and nothing
# else, and asking pg_dump for a table that is not there is an error rather
# than an empty file.
WANTED=()
for table in users identities; do
  found=$(psql -tA -d "$DATABASE_URL" -c \
    "select to_regclass('auth.$table') is not null;" 2>/dev/null || echo "f")
  if [ "$found" = "t" ]; then
    WANTED+=(--table="auth.$table")
  fi
done

if [ ${#WANTED[@]} -eq 0 ]; then
  echo "::error::this database has no auth tables, which cannot be right."
  exit 1
fi

pg_dump \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-privileges \
  "${WANTED[@]}" \
  --dbname="$DATABASE_URL" \
  | encrypt "$PEOPLE"

# A dump smaller than its own header is a dump of nothing, which is the
# failure this whole file exists to avoid and the one that looks like success.
for file in "$GAME" "$PEOPLE"; do
  size=$(wc -c < "$file")
  if [ "$size" -lt 400 ]; then
    echo "::error::$file is only $size bytes, which is not a backup."
    exit 1
  fi
  echo "$file ($size bytes)"
done
