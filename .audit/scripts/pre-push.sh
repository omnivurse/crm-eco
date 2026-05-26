#!/usr/bin/env bash
# Optional Git pre-push hook for the Hawkeye audit.
#
# Skips the schema refresh (which needs DB credentials), but rebuilds the
# code inventory and reruns the cross-reference + baseline check.
# Aborts the push only on NEW findings at HIGH or higher.
#
# Install (per-clone):
#   ln -s ../../.audit/scripts/pre-push.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# Override (escape hatch — use sparingly):
#   git push --no-verify

set -e

# Skip during interactive rebases, bisect, etc.
if [[ -n "${GIT_REBASE_TODO:-}" || -n "${GIT_BISECT:-}" ]]; then
  exit 0
fi

# Honor explicit opt-out so the hook never blocks emergency hotfixes.
if [[ "${SKIP_HAWKEYE:-0}" == "1" ]]; then
  echo "[hawkeye/pre-push] SKIP_HAWKEYE=1 set — skipping audit."
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [[ ! -f .audit/schema/columns.csv ]]; then
  echo "[hawkeye/pre-push] no local schema snapshot — skipping audit (run \`.audit/scripts/refresh-schema.sh\` once to enable)."
  exit 0
fi

echo "[hawkeye/pre-push] running code inventory + crossref…"
node .audit/scripts/inventory.mjs >/dev/null
node .audit/scripts/crossref.mjs >/dev/null

echo "[hawkeye/pre-push] diffing against baseline…"
if ! AUDIT_FAIL_AT="${AUDIT_FAIL_AT:-HIGH}" node .audit/scripts/check-baseline.mjs; then
  echo
  echo "[hawkeye/pre-push] ❌ audit blocked the push."
  echo "  - Fix the new finding(s) and push again, or"
  echo "  - If the finding is intentional, refresh the baseline:"
  echo "      AUDIT_UPDATE_BASE=1 node .audit/scripts/check-baseline.mjs"
  echo "      git add .audit/baseline.json && git commit --amend"
  echo "  - Emergency override (avoid except for hotfixes): SKIP_HAWKEYE=1 git push"
  exit 1
fi

exit 0
