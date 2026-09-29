#!/usr/bin/env bash
# Aplica todas las migraciones en una base Postgres temporal y corre
# tests/db/checks.sql. Requiere psql/createdb (Postgres local o PG* en CI).
set -euo pipefail

cd "$(dirname "$0")/.."
DB="altaentrega_test_$$"

createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

run -f tests/db/supabase_stubs.sql > /dev/null
for migration in supabase/migrations/*.sql; do
  run -f "$migration" > /dev/null
done
run -f tests/db/checks.sql
