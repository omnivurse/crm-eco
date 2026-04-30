#!/usr/bin/env sh
# Block accidental duplication of this repo inside itself (nested .git breaks
# tooling and has been mistaken for normal content). Intended for pre-push CI.
#
# Also fails if `/crm-eco/` is accidentally tracked despite .gitignore.
set -e
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="."
cd "$ROOT" || exit 1

if git ls-files -- 'crm-eco' 2>/dev/null | grep -q .; then
  echo >&2 "ERROR: Paths under ``crm-eco/`` are tracked by git. Run: git rm -r --cached crm-eco"
  exit 1
fi

if [ -d "crm-eco/.git" ]; then
  echo >&2 "ERROR: Found nested repository at ./crm-eco/.git"
  echo >&2 "       This is almost always a mistaken clone. Delete it: rm -rf crm-eco"
  echo >&2 "       (The real project root is this directory, not crm-eco/crm-eco.)"
  exit 1
fi

if ! grep -qxF '/crm-eco/' .gitignore 2>/dev/null; then
  echo >&2 "WARN: .gitignore should contain exactly ``/crm-eco/`` to ignore nested clones."
fi

echo "workspace-hygiene: OK"
