# crm-eco mail map

Authoritative map of the live email system. Design against this, not a generic MailSuite schema.

## Product

Resend **shared-mailbox inbox**, not personal Gmail/Outlook sync.

PIFH hybrid ([`packages/lib/src/email/pifh-email-addresses.ts`](../../../../../packages/lib/src/email/pifh-email-addresses.ts)):

- `@payitforwardhealth.com` — Google Workspace staff mail (not synced)
- `mail.payitforwardhealth.com` — Resend inbound → CRM inbox
- Outbound From = registered `email_sender_addresses`

## Live tables (already migrated, RLS on)

| Table | Role |
|---|---|
| `inbox_conversations` / `inbox_messages` | Unified inbox |
| `email_domains` / `email_sender_addresses` | Sending + inbound routing |
| `sent_emails` | Delivery audit log |
| `email_unsubscribes` | Suppression |
| `email_send_outbox` | Canonical outbound command ledger |
| `provider_inbound_events` | Inbound/webhook receipt ledger |
| `communication_record_links` / `message_participants` | Inbox ↔ CRM record links |
| `comms_sync_cursors` / `comms_dead_letters` | Sync + DLQ (mailbox OAuth later) |
| `email_connections` / `email_threads` / `email_messages` | Schema-only personal mailbox (Phase 3) |

Do **not** create `001_mail_core.sql` tables.

## Feature flags (`crm_feature_flags`, default off)

| Flag | Meaning |
|---|---|
| `crm.comms.outbox_send` | Human compose/reply persists `email_send_outbox` before provider submit |
| `crm.comms.closed_loop` | `email-intake` ledgers `provider_inbound_events` first |
| `crm.comms.kill_switch` | Blocks new outbound provider submits |
| `crm.comms.mailbox_oauth` | Personal mailbox OAuth — **fail-closed, not implemented** |
| `crm.comms.foundation` / `collab` / `calendar_sync` / `automation_ai` | Later gates |

Enabling flags in production or sending non-test mail requires explicit approval.

## Send paths

| Path | Entry | After this work |
|---|---|---|
| Human compose / inbox reply | `/api/communications/send` → `send-service.ts` | Envelope + RFC822 headers; inbox persist on server; outbox when flag on |
| Record automations | `/api/comms/send` → `dispatcher.ts` | Email also enqueues outbox |
| Sequences | `enrollment-service.ts` | Outbox (`sequence/{enrollment}/{step}`) — no dead `sent_emails queued` worker |
| Campaigns | `/api/campaigns/[id]/send` | Suppression + outbox + tracking pixel |
| Outbox worker | `/api/email/outbox/process` | Claims leased rows, submits, retries |
| Admin / tickets / queue | edge `send-email`, `send-ticket-email`, `notification_queue` | Legacy; do not delete in this slice |

## Threading

Generate RFC822 `Message-ID` before send. Pass `In-Reply-To` + `References` to Resend. Store the same values on `inbox_messages`. Provider id → `external_id` only.

Helpers: [`apps/crm/src/lib/email/rfc822.ts`](../../../../../apps/crm/src/lib/email/rfc822.ts)

## Inbound

`Resend inbound webhook` → `supabase/functions/email-intake` → (flag on: ledger) → `inbox_*`.

## Phase 3 — mailbox OAuth (gated)

Not implemented. `MAILBOX_OAUTH_IMPLEMENTED = false`. Connect API returns 403.

When approved later:

- Reuse `email_connections` + `comms_sync_cursors`
- Mail scopes ≠ calendar scopes
- Send-as-user still goes through `email_send_outbox`
- Gmail restricted scopes imply verification/CASA

## Proof

```bash
node scripts/verify-mail-release.sh
```
