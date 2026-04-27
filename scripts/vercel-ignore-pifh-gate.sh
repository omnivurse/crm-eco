#!/usr/bin/env bash
# Vercel "Ignored Build Step" wrapper for the PIFH deploy gate.
#
# Vercel ignoreCommand semantics:
#   exit 0 → SKIP the deploy
#   exit 1 → PROCEED with the deploy
#
# We invert the natural exit code of the gate script so:
#   gate passes (exit 0) → wrapper exits 1 → Vercel proceeds
#   gate fails  (exit 1) → wrapper exits 0 → Vercel SKIPS
#
# Wire this up in each Vercel project (admin / marketing / crm) under
# Settings → Git → Ignored Build Step:
#
#   bash scripts/vercel-ignore-pifh-gate.sh
#
# Required Vercel env: SUPABASE_DB_URL  (postgres connection string with
# read access to the PIFH project — pooled URL works fine).

set -uo pipefail

# Skip the gate for non-production deploys (preview branches still
# benefit from a clean signal, but PR previews should not block).
if [[ "${VERCEL_ENV:-}" != "production" ]]; then
  echo "PIFH gate skipped (VERCEL_ENV=${VERCEL_ENV:-unset}, only enforced on production)."
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "PIFH gate skipped — SUPABASE_DB_URL not set in Vercel project."
  echo "Add a read-only Postgres URL pointing at sffisarikcreyyjzdjvb to enforce the gate."
  exit 1
fi

if node scripts/pifh-deploy-gate.mjs; then
  echo "PIFH gate PASSED — letting Vercel build & deploy."
  exit 1
else
  echo "PIFH gate FAILED — instructing Vercel to skip this deploy."
  exit 0
fi
