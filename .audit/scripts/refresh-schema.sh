#!/usr/bin/env bash
# Refresh `.audit/schema/*.csv` from a live Postgres database (PIFH or any
# Supabase project). Used by `node .audit/scripts/crossref.mjs` and by the
# Hawkeye CI workflow.
#
# Usage:
#   PGHOST=...  PGUSER=postgres  PGPASSWORD=...  PGDATABASE=postgres  \
#     .audit/scripts/refresh-schema.sh
#
# Or with a single connection URL:
#   PIFH_SUPABASE_DB_URL=postgresql://...  .audit/scripts/refresh-schema.sh
#
# Outputs into `.audit/schema/`:
#   tables.csv             (name, type, bytes, approx_rows)
#   views.csv              (view_name)
#   columns.csv            (table_name, column_name, data_type, is_nullable, default)
#   foreign_keys.csv       (table, column, ref_table, ref_column, on_delete, on_update)
#   indexes.csv            (table, index_name, definition)
#   functions.csv          (function_name, arg_types, return_type)
#   rls_enabled.csv        (table_name, rls_enabled)
#   rls_policies.csv       (schema, table, policy, roles, cmd, qual, with_check)
#   applied_migrations.csv (version)
#
# Exit codes:
#   0  → all CSVs written
#   1  → connection failure or required env var missing
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCHEMA_DIR="$REPO_ROOT/.audit/schema"
mkdir -p "$SCHEMA_DIR"

# Resolve connection target. Prefer PIFH_SUPABASE_DB_URL (matches the rest of CI).
DB_URL="${PIFH_SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" && -n "${PGHOST:-}" ]]; then
  : # rely on libpq env vars
elif [[ -z "$DB_URL" ]]; then
  echo "[refresh-schema] error: PIFH_SUPABASE_DB_URL (or DATABASE_URL, or PGHOST/...) is required." >&2
  exit 1
fi

PSQL=(psql --csv -t -X --quiet --set=ON_ERROR_STOP=1)
if [[ -n "$DB_URL" ]]; then PSQL+=("$DB_URL"); fi

echo "[refresh-schema] target: ${DB_URL:-libpq env}"

# Probe connection up-front so failures surface fast in CI.
"${PSQL[@]}" -c "SELECT 1;" >/dev/null

# ---- tables.csv ----------------------------------------------------------
{ echo "table_name,table_type,bytes,approx_rows"
  "${PSQL[@]}" -c "
    SELECT c.relname AS table_name,
           CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned' ELSE c.relkind::text END AS table_type,
           pg_total_relation_size(c.oid) AS bytes,
           c.reltuples::bigint AS approx_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
    ORDER BY c.relname;
  "
} > "$SCHEMA_DIR/tables.csv"

# ---- views.csv -----------------------------------------------------------
{ echo "view_name"
  "${PSQL[@]}" -c "
    SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY viewname;
  "
} > "$SCHEMA_DIR/views.csv"

# ---- columns.csv ---------------------------------------------------------
{ echo "table_name,column_name,data_type,is_nullable,column_default"
  "${PSQL[@]}" -c "
    SELECT table_name, column_name, data_type, is_nullable,
           COALESCE(column_default, '') AS column_default
    FROM information_schema.columns
    WHERE table_schema='public'
    ORDER BY table_name, ordinal_position;
  "
} > "$SCHEMA_DIR/columns.csv"

# ---- foreign_keys.csv ----------------------------------------------------
# Column names match what `crossref.mjs` reads: from_table/from_column/to_table/to_column.
{ echo "from_table,from_column,to_table,to_column,delete_rule,update_rule"
  "${PSQL[@]}" -c "
    SELECT tc.table_name      AS from_table,
           kcu.column_name    AS from_column,
           ccu.table_name     AS to_table,
           ccu.column_name    AS to_column,
           rc.delete_rule,
           rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name AND rc.unique_constraint_schema = ccu.table_schema
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
    ORDER BY tc.table_name, kcu.column_name;
  "
} > "$SCHEMA_DIR/foreign_keys.csv"

# ---- indexes.csv ---------------------------------------------------------
# Column names match what `crossref.mjs` reads: schemaname/tablename/indexname/indexdef.
{ echo "schemaname,tablename,indexname,indexdef"
  "${PSQL[@]}" -c "
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes WHERE schemaname='public'
    ORDER BY tablename, indexname;
  "
} > "$SCHEMA_DIR/indexes.csv"

# ---- functions.csv -------------------------------------------------------
{ echo "function_name,arg_types,return_type"
  "${PSQL[@]}" -c "
    SELECT p.proname,
           pg_get_function_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS returns
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prokind = 'f'
    ORDER BY p.proname;
  "
} > "$SCHEMA_DIR/functions.csv"

# ---- rls_enabled.csv -----------------------------------------------------
{ echo "table_name,rls_enabled"
  "${PSQL[@]}" -c "
    SELECT c.relname, CASE WHEN c.relrowsecurity THEN 't' ELSE 'f' END
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
    ORDER BY c.relname;
  "
} > "$SCHEMA_DIR/rls_enabled.csv"

# ---- rls_policies.csv ----------------------------------------------------
{ echo "schemaname,tablename,policyname,roles,cmd,qual,with_check"
  "${PSQL[@]}" -c "
    SELECT schemaname, tablename, policyname,
           array_to_string(roles, '|') AS roles,
           cmd::text,
           COALESCE(qual, '') AS qual,
           COALESCE(with_check, '') AS with_check
    FROM pg_policies WHERE schemaname='public'
    ORDER BY tablename, policyname;
  "
} > "$SCHEMA_DIR/rls_policies.csv"

# ---- enums.csv -----------------------------------------------------------
{ echo "schema,enum_name,enumlabel,enumsortorder"
  "${PSQL[@]}" -c "
    SELECT n.nspname, t.typname, e.enumlabel, e.enumsortorder
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname='public'
    ORDER BY t.typname, e.enumsortorder;
  "
} > "$SCHEMA_DIR/enums.csv"

# ---- triggers.csv --------------------------------------------------------
{ echo "table_name,trigger_name,events,action_timing,action_orientation,action_statement"
  "${PSQL[@]}" -c "
    SELECT event_object_table,
           trigger_name,
           string_agg(event_manipulation, ',' ORDER BY event_manipulation),
           action_timing,
           action_orientation,
           action_statement
    FROM information_schema.triggers
    WHERE trigger_schema='public'
    GROUP BY event_object_table, trigger_name, action_timing, action_orientation, action_statement
    ORDER BY event_object_table, trigger_name;
  "
} > "$SCHEMA_DIR/triggers.csv"

# ---- check_constraints.csv ----------------------------------------------
{ echo "table_name,constraint_name,check_clause"
  "${PSQL[@]}" -c "
    SELECT tc.table_name, tc.constraint_name, cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name AND tc.constraint_schema = cc.constraint_schema
    WHERE tc.constraint_type='CHECK' AND tc.table_schema='public'
    ORDER BY tc.table_name, tc.constraint_name;
  "
} > "$SCHEMA_DIR/check_constraints.csv"

# ---- realtime_publication.csv -------------------------------------------
{ echo "schemaname,tablename"
  "${PSQL[@]}" -c "
    SELECT schemaname, tablename
    FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
    ORDER BY schemaname, tablename;
  "
} > "$SCHEMA_DIR/realtime_publication.csv"

# ---- storage_buckets.csv ------------------------------------------------
{ echo "id,name,public,file_size_limit,created_at"
  "${PSQL[@]}" -c "
    SELECT id, name, public, COALESCE(file_size_limit::text, ''), created_at
    FROM storage.buckets ORDER BY name;
  "
} > "$SCHEMA_DIR/storage_buckets.csv"

# ---- applied_migrations.csv ----------------------------------------------
# Single-column file (just the version strings) — matches what crossref.mjs
# treats as a `Set` of applied versions.
"${PSQL[@]}" -c "
  SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
" | tr -d ' ' | grep -v '^$' > "$SCHEMA_DIR/applied_migrations.csv"

# ---- Summary -------------------------------------------------------------
echo "[refresh-schema] wrote:"
for f in tables.csv views.csv columns.csv foreign_keys.csv indexes.csv functions.csv rls_enabled.csv rls_policies.csv enums.csv triggers.csv check_constraints.csv realtime_publication.csv storage_buckets.csv applied_migrations.csv; do
  if [[ -f "$SCHEMA_DIR/$f" ]]; then
    printf "  %-26s  %s rows\n" "$f" "$(wc -l < "$SCHEMA_DIR/$f")"
  fi
done
