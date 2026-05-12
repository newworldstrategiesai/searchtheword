#!/usr/bin/env bash
# Copy Postgres data between Supabase projects using pg_dump/psql (no Docker).
# Uses PGPASSWORD so special characters in DB passwords (e.g. %) are safe.
#
# Prerequisite: Homebrew libpq — brew install libpq
#
# 1) Apply the same schema on NEW as OLD (e.g. setup_complete.sql + 005_*.sql),
#    OR set MIGRATE_MODE=full for a full logical dump (see warnings below).
#
# 2) Set env vars (do not commit secrets):
#
#   export OLD_SUPABASE_DB_REF=fwinuwatqdvuexyivbwu
#   export NEW_SUPABASE_DB_REF=dowrojncfrjenwtzopsr
#   export OLD_SUPABASE_DB_PASSWORD='...'
#   export NEW_SUPABASE_DB_PASSWORD='...'
#
# 3) Run:
#
#   ./scripts/migrate-supabase-data.sh
#
# Optional: DUMP_PATH=/tmp/my-dump.sql ./scripts/migrate-supabase-data.sh
#
# If "could not translate host name" for db.<ref>.supabase.co, use the Session
# pooler from Dashboard → Connect (host like aws-0-REGION.pooler.supabase.com):
#
#   export OLD_SUPABASE_DB_HOST=aws-0-us-east-1.pooler.supabase.com   # example
#   export OLD_SUPABASE_DB_USER=postgres.fwinuwatqdvuexyivbwu
#   export NEW_SUPABASE_DB_HOST=aws-0-us-east-1.pooler.supabase.com
#   export NEW_SUPABASE_DB_USER=postgres.dowrojncfrjenwtzopsr
#
# Use the exact host + users from YOUR project's Connect panel (region varies).

set -euo pipefail

export PGSSLMODE="${PGSSLMODE:-require}"

MIGRATE_MODE="${MIGRATE_MODE:-data}"
DUMP_PATH="${DUMP_PATH:-/tmp/searchtheword-supabase-dump.sql}"

OLD_REF="${OLD_SUPABASE_DB_REF:-}"
NEW_REF="${NEW_SUPABASE_DB_REF:-}"
OLD_PASS="${OLD_SUPABASE_DB_PASSWORD:-}"
NEW_PASS="${NEW_SUPABASE_DB_PASSWORD:-}"

if [[ -z "$OLD_REF" || -z "$NEW_REF" || -z "$OLD_PASS" || -z "$NEW_PASS" ]]; then
  echo "Missing env vars. Required:" >&2
  echo "  OLD_SUPABASE_DB_REF   (e.g. fwinuwatqdvuexyivbwu)" >&2
  echo "  NEW_SUPABASE_DB_REF   (new project ref)" >&2
  echo "  OLD_SUPABASE_DB_PASSWORD   (Dashboard → Database → password)" >&2
  echo "  NEW_SUPABASE_DB_PASSWORD" >&2
  exit 1
fi

# libpq on PATH (common Homebrew locations)
if [[ -d /opt/homebrew/opt/libpq/bin ]]; then
  export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
elif [[ -d /usr/local/opt/libpq/bin ]]; then
  export PATH="/usr/local/opt/libpq/bin:$PATH"
fi

for cmd in pg_dump psql; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing $cmd. Install: brew install libpq" >&2
    echo "Then add to PATH, e.g.: export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"" >&2
    exit 1
  fi
done

OLD_HOST="${OLD_SUPABASE_DB_HOST:-db.${OLD_REF}.supabase.co}"
NEW_HOST="${NEW_SUPABASE_DB_HOST:-db.${NEW_REF}.supabase.co}"
OLD_USER="${OLD_SUPABASE_DB_USER:-postgres}"
NEW_USER="${NEW_SUPABASE_DB_USER:-postgres}"
OLD_PORT="${OLD_SUPABASE_DB_PORT:-5432}"
NEW_PORT="${NEW_SUPABASE_DB_PORT:-5432}"

dump_args=( -h "$OLD_HOST" -p "$OLD_PORT" -U "$OLD_USER" -d postgres )
dump_args+=( --no-owner --no-privileges -F p -f "$DUMP_PATH" )

if [[ "$MIGRATE_MODE" == "data" ]]; then
  echo "Mode: data-only (NEW database must already match OLD schema)."
  dump_args+=( --data-only )
elif [[ "$MIGRATE_MODE" == "full" ]]; then
  echo "Mode: full dump (schema + data). NEW DB should be empty or you accept conflicts."
  echo "If restore fails, use Supabase's official roles/schema/data flow instead:"
  echo "https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore"
else
  echo "MIGRATE_MODE must be 'data' or 'full' (got: $MIGRATE_MODE)" >&2
  exit 1
fi

echo "Dumping from $OLD_USER@$OLD_HOST:$OLD_PORT → $DUMP_PATH ..."
PGPASSWORD="$OLD_PASS" pg_dump "${dump_args[@]}"

echo "Restoring into $NEW_USER@$NEW_HOST:$NEW_PORT ..."
PGPASSWORD="$NEW_PASS" psql \
  -h "$NEW_HOST" -p "$NEW_PORT" -U "$NEW_USER" -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "SET session_replication_role = replica" \
  -f "$DUMP_PATH"

echo "Done. Verify in NEW project SQL editor, e.g.:"
echo "  select count(*) from public.sermons;"
