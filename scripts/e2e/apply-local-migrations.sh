#!/usr/bin/env bash
# apply-local-migrations.sh — bring the LOCAL Supabase stack up to the repo's
# supabase/migrations/*.sql without ever touching prod.
#
# WHY: in this repo `supabase db push` / `db reset` target PROD (the CLI link),
# so the local stack is driven with psql only. After `supabase start` the local
# ledger (supabase_migrations.schema_migrations) can lag the repo — and some
# files may have been psql-applied by hand without a ledger row. This script:
#   - refuses any DB URL whose host is not 127.0.0.1 / localhost
#   - for every migration file whose version is NEWER than max(ledger.version)
#     AND absent from the ledger, runs it in ONE transaction
#     (psql -v ON_ERROR_STOP=1 --single-transaction) and inserts the ledger row
#     on success — a failing file rolls back completely, is reported, and the
#     run continues with the next file
#   - classifies a failure whose error says "already exists"/"duplicate key"
#     as ALREADY-PRESENT (the file was applied out-of-band without a ledger
#     row; nothing is half-applied because the transaction rolled back)
#
# USAGE
#   scripts/e2e/apply-local-migrations.sh            # default local URL
#   LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
#     scripts/e2e/apply-local-migrations.sh
#   scripts/e2e/apply-local-migrations.sh --strict   # exit 1 on any hard failure
#   scripts/e2e/apply-local-migrations.sh --dry-run  # list only, no writes
#   scripts/e2e/apply-local-migrations.sh --mark 20260820150000
#       # record a ledger row for a file you VERIFIED is already in effect
#       # (e.g. applied by hand, and a later migration changed a signature so
#       # the re-run can no longer succeed) — no SQL from the file is run
#
# CI (.github/workflows/crm-walk.yml) runs it right after `supabase start`, as
#   LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
#     scripts/e2e/apply-local-migrations.sh --strict
# and relies on these non-interactive guarantees:
#   - psql is called with -w, so a URL without a password FAILS instead of
#     blocking on a password prompt forever
#   - WAIT_FOR_DB_SECONDS (default 60) polls the DB before doing anything, so a
#     container that is still coming up is a wait, not a flake; 0 disables it
#   - PGCONNECT_TIMEOUT (default 10) bounds every connection attempt
#   - LC_ALL=C makes the version comparison collation-independent
#   - no prompts, no editors, no psqlrc (-X), no writes outside the local DB
#
# Exit codes: 0 ok (or soft failures without --strict), 1 hard failure in
# --strict mode, 2 refused (non-local URL / missing psql / unreachable DB /
# bad args).
set -uo pipefail
export LC_ALL=C
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG_DIR="$REPO_ROOT/supabase/migrations"
DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
STRICT=0
DRY=0
MARK=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) STRICT=1 ;;
    --dry-run) DRY=1 ;;
    --mark) shift; MARK="${1:-}"; [[ -n "$MARK" ]] || { echo "--mark needs a version" >&2; exit 2; } ;;
    -h|--help) sed -n '2,/^set -uo pipefail/p' "$0" | sed '$d'; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

# ---- local-only guard --------------------------------------------------------
host="$(printf '%s' "$DB_URL" | sed -E 's#^[a-z]+://([^@]*@)?([^:/?]+).*#\2#')"
case "$host" in
  127.0.0.1|localhost|::1) ;;
  *) echo "REFUSED: DB host '$host' is not local (127.0.0.1/localhost). This script never targets a remote database." >&2; exit 2 ;;
esac
command -v psql >/dev/null || { echo "psql not found" >&2; exit 2; }

PSQL=(psql "$DB_URL" -X -q -w -v ON_ERROR_STOP=1)

# ---- wait for the local DB (CI: the container may still be starting) ---------
wait_secs="${WAIT_FOR_DB_SECONDS:-60}"
waited=0
until "${PSQL[@]}" -At -c 'select 1' >/dev/null 2>&1; do
  if [[ "$waited" -ge "$wait_secs" ]]; then
    echo "REFUSED: no local Postgres on $host after ${wait_secs}s. Start the stack first (CI: \`supabase start\`)." >&2
    exit 2
  fi
  sleep 2
  waited=$((waited + 2))
done
[[ "$waited" -gt 0 ]] && echo "waited ${waited}s for the local DB"

ledger_max="$("${PSQL[@]}" -At -c "select coalesce(max(version),'0') from supabase_migrations.schema_migrations")" || { echo "cannot read ledger" >&2; exit 2; }
ledger_versions="$("${PSQL[@]}" -At -c "select version from supabase_migrations.schema_migrations")"

if [[ -n "$MARK" ]]; then
  f="$(ls "$MIG_DIR"/"$MARK"_*.sql 2>/dev/null | head -1)"
  [[ -n "$f" ]] || { echo "no migration file for version $MARK" >&2; exit 2; }
  n="$(basename "$f")"; n="${n#*_}"; n="${n%.sql}"
  "${PSQL[@]}" -c "insert into supabase_migrations.schema_migrations(version, name) values ('$MARK', '$n') on conflict (version) do nothing" >/dev/null \
    && echo "marked $MARK ($n) as applied in the local ledger (no SQL run)" || { echo "mark failed" >&2; exit 1; }
  exit 0
fi

echo "local DB : $host"
echo "ledger   : $(printf '%s\n' "$ledger_versions" | grep -c .) rows, max version $ledger_max"

applied=(); present=(); failed=(); skipped_in_ledger=()
for path in "$MIG_DIR"/*.sql; do
  file="$(basename "$path")"
  version="${file%%_*}"
  name="${file#*_}"; name="${name%.sql}"
  # newer than ledger max (string compare works: fixed-width numeric prefixes)
  [[ "$version" > "$ledger_max" ]] || continue
  if printf '%s\n' "$ledger_versions" | grep -qx "$version"; then
    skipped_in_ledger+=("$file"); continue
  fi
  if [[ $DRY -eq 1 ]]; then echo "would apply: $file"; continue; fi

  errfile="$(mktemp)"
  if "${PSQL[@]}" --single-transaction -f "$path" >/dev/null 2>"$errfile"; then
    "${PSQL[@]}" -c "insert into supabase_migrations.schema_migrations(version, name) values ('$version', '$name') on conflict (version) do nothing" >/dev/null \
      && applied+=("$file") && echo "APPLIED          $file" \
      || { failed+=("$file (ledger insert failed)"); echo "FAILED (ledger)  $file"; }
  else
    err="$(grep -E 'ERROR|DETAIL' "$errfile" | head -3 | tr '\n' ' ')"
    # Only ERROR lines count — a NOTICE like "schema already exists, skipping" is not a duplicate.
    if grep -E '^psql:.*ERROR|^ERROR' "$errfile" | grep -qiE 'already exists|duplicate key|duplicate object'; then
      present+=("$file")
      echo "ALREADY-PRESENT  $file  — rolled back; $err"
    else
      failed+=("$file")
      echo "FAILED           $file  — rolled back; $err"
    fi
  fi
  rm -f "$errfile"
done

echo
echo "summary: applied=${#applied[@]} already-present=${#present[@]} failed=${#failed[@]} in-ledger-already=${#skipped_in_ledger[@]}"
for f in ${applied[@]+"${applied[@]}"}; do echo "  applied          $f"; done
for f in ${present[@]+"${present[@]}"}; do echo "  already-present  $f"; done
for f in ${failed[@]+"${failed[@]}"};  do echo "  FAILED           $f"; done
new_max="$("${PSQL[@]}" -At -c "select max(version) from supabase_migrations.schema_migrations")"
echo "ledger max now: $new_max"
if [[ $STRICT -eq 1 && ${#failed[@]} -gt 0 ]]; then exit 1; fi
exit 0
