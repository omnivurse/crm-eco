#!/usr/bin/env sh
# Fails when a spec drives the page with raw Playwright actions instead of the
# `walk` fixture. Raw actions are invisible to the click/keypress tally, so the
# isTrusted cross-check in walk-fixture.ts would throw at task end anyway —
# this guard catches it earlier (CI grep, EV-4 acceptance).
set -eu
cd "$(dirname "$0")"
PATTERN='((^|[^A-Za-z0-9_.])page\.(click|dblclick|press|fill|type|tap|pressSequentially)\(|\.keyboard\.(press|type|down|up|insertText)\(|\.mouse\.(click|down|up|dblclick|wheel)\(|\.(click|dblclick|press|fill|pressSequentially|tap|setChecked|check|uncheck|selectOption)\()'
# Neutralise the sanctioned wrappers first so `walk.click(` never masks a raw
# `.click(` sitting on the same line, then look for what is left.
hits=$(grep -rn '' specs 2>/dev/null \
  | sed -E 's/walk\.(click|press|type)\(/WALK_ACTION(/g' \
  | grep -vE '^[^:]+:[0-9]+:\s*(//|\*)' \
  | grep -E "$PATTERN" \
  || true)
if [ -n "$hits" ]; then
  echo "check-no-raw-actions: raw Playwright actions found in e2e/specs — wrap them with the walk fixture:" >&2
  echo "$hits" >&2
  exit 1
fi
echo "check-no-raw-actions: OK (no raw page.click/press/fill in e2e/specs)"
