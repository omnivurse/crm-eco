---
name: cto-mailsuite-architect
description: Build, patch, debug, audit, and release the CRM-ECO email system (Resend shared mailbox, outbox, inbound ledger, threading, deliverability). Use whenever the user mentions email, inbox, Resend, MailSuite, send, reply headers, campaigns, sequences, or mailbox OAuth.
version: 2.0.0
---

# CTO MailSuite Architect (crm-eco)

## Purpose

Produce working vertical slices for CRM email in **this repository**. Do not invent a parallel mail schema. Load [references/crm-eco-mail-map.md](references/crm-eco-mail-map.md) first.

## Route the Request First

Choose exactly one primary mode. Add a secondary mode only when required.

| User intent | Primary mode | Output contract |
|---|---|---|
| “Add/fix this function, header, rule, component, or endpoint” | `PATCH` | Inspect the narrow path, modify code, add tests, run proof commands, report changed files and residual risk. |
| “Build the inbox/email module” | `BUILD` | Discover existing architecture, select one vertical slice, implement DB → service → provider adapter → API → UI → audit → tests. |
| “Why is sync/send/threading broken?” | `DEBUG` | Reproduce, classify provider error, identify invariant violation, patch, regression-test, prove. |
| “Audit/review the email system” | `AUDIT` | Evidence-backed findings with severity, exact paths, exploit/failure mode, and executable remediation. |
| “Design/plan the architecture” | `DESIGN` | ADR, boundaries, contracts, schema changes, threat model, phases, acceptance criteria. No pretend implementation. |
| “Harden/release/verify production readiness” | `RELEASE` | Run release checks, collect proof, block on failed gates, produce rollback and monitoring commands. |
| “Implement Gmail/Graph/provider sync” | `SYNC` | Gated. See mail map Phase 3. Do not start until Phase 1–2 release gates pass. |
| “Fix deliverability/domains/unsubscribe” | `DELIVERABILITY` | Implement DNS state, event ingestion, suppression, RFC 8058 where applicable, and provider-specific proof. |

### Routing rules

- A focused request must not receive a capability matrix or 12-section report.
- A build request must not stop after a plan unless the user explicitly requested planning only.
- An audit must not modify code unless asked.
- A patch must not redesign unrelated tables.
- When repository context is missing, inspect first; do not invent filenames, framework, or tenancy model.
- **Do not apply** generic `templates/001_mail_core.sql`. The live comms foundation tables already exist.

## Load Only the References Needed

- This repo’s tables, flags, send paths, PIFH domain split: `references/crm-eco-mail-map.md`
- Threading helpers: `apps/crm/src/lib/email/rfc822.ts`
- Outbox: `apps/crm/src/lib/email/outbox.ts`
- Inbound ledger: `apps/crm/src/lib/email/inbound-ledger.ts` and `supabase/functions/_shared/inbound-ledger.ts`

Do not restate entire references in the response. Apply them.

## Non-Negotiable Invariants

1. **No fake success.** `sent`, `synced`, `connected`, `verified`, and `scheduled` require authoritative backend state.
2. **Tenant scope everywhere.** Rows, jobs, webhooks, attachments, search, caches, and audit events are tenant-scoped and database-enforced.
3. **Provider IDs are scoped.** A provider message ID is unique only within its provider/account context.
4. **Canonical outbound envelope is stored before send.** Persist To/Cc/Bcc and the immutable request snapshot on `email_send_outbox` before calling the provider when `crm.comms.outbox_send` is on. Never reconstruct Bcc from Sent Items.
5. **Threading is header-driven.** Preserve `Message-ID`, `In-Reply-To`, and `References` on the wire; provider thread IDs are hints scoped to one provider/account, not universal truth.
6. **Every external event is ledgered before processing.** When `crm.comms.closed_loop` is on, webhook receipt (`provider_inbound_events`) and processing are separate, idempotent steps.
7. **Every retry has a class.** Retry only errors classified as transient or explicitly recoverable. Honor `Retry-After`.
8. **No hand-built production MIME.** Use a proven MIME library or the provider JSON API; test generated payloads.
9. **Least privilege OAuth.** Mail scopes are not calendar scopes. `crm.comms.mailbox_oauth` is gated and fail-closed until Phase 3 is approved.
10. **Current provider limits are configuration, not folklore.** Consult current official documentation.

## Required Execution Loop

1. Discover from repository evidence and live schema (not migration folklore).
2. State the invariant being changed.
3. Implement the smallest complete vertical slice.
4. Prove it: formatter, typecheck, unit tests, `scripts/verify-mail-release.sh`.
5. Report by mode (PATCH / BUILD / AUDIT / DESIGN / RELEASE).

## Definition of Done

A mail change is done only when:

- The authoritative state transition is durable and idempotent.
- Duplicate requests/events are proven harmless.
- Provider-specific failure behavior is covered.
- Tenant isolation is tested.
- Thread and MIME fixtures are tested when message construction changes.
- Logs identify tenant, account, command/job/event IDs without leaking tokens or sensitive body content.
- Rollback does not corrupt cursors, ledgers, or sent-state truth.
- Production flag flips and real sends require explicit approval.
