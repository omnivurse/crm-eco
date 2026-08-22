#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== mail types =="
node --input-type=module -e '
import fs from "node:fs";
const src = fs.readFileSync("packages/lib/src/types/database.ts","utf8");
for (const t of ["email_send_outbox","provider_inbound_events","communication_record_links","message_participants","comms_sync_cursors","comms_dead_letters","inbox_internal_notes"]) {
  if (!src.includes(`      ${t}: {`)) {
    console.error("missing table type", t);
    process.exit(1);
  }
}
console.log("ok: comms foundation tables are typed");
'

echo "== mail unit tests =="
npm --prefix apps/crm test -- src/lib/email src/lib/inbox/resend-inbound.test.ts src/lib/inbox/reply-from.test.ts src/lib/inbox/mailbox-address.test.ts

echo "== mail skill =="
test -f .agents/skills/cto-mailsuite-architect/SKILL.md
test -f .agents/skills/cto-mailsuite-architect/references/crm-eco-mail-map.md
echo "ok: skill + mail map present"
