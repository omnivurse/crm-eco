# 07 — Payables Module

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (synthesized in package voice)

Build **Enterprise Payables**: vendor/payee ledger, bills, approvals, payment runs, scheduling, categories/GL coding, recurring payables, attachments, export to accounting, audit trail, and AI-assisted categorization and anomaly detection. Payables must reconcile against commissions payouts and vendor (carrier) costs.

---

## Current State

Payables is **full but entirely bespoke** — one ~900-line page.

- Pages: `payables/page.tsx` (inline create modal, edit, status transitions, delete, search, payee/status filters, pagination, CSV export, notes field), `payables/summary/page.tsx` (analytics).

## Gap Analysis

| vNext area | Status |
|---|---|
| CRUD + status transitions | Present |
| Search / filter / export | Present (inline) |
| Summary analytics | Present |
| Detail route `/payables/[id]` | Missing (all inline) |
| Approvals workflow | Missing |
| Payment runs / batching | Missing |
| Recurring payables | Missing |
| GL coding / categories | Missing |
| Attachments | Missing |
| Audit timeline UI | Missing |
| Import | Missing |
| Reconciliation vs commissions/vendor cost | Missing |

## Build Notes

- Payables is a textbook **shallow-page-that-should-be-a-deep-module** case: ~900 lines of inline logic that the shared list-view + resource scaffold (`02`) would absorb, adding detail route, audit, attachments, and import "for free".
- Approvals → route through the workflow/approvals engine (`19`), reusing CRM's `apps/crm/src/lib/approvals/`.
- Reconciliation: join payables against `commission_payouts` and vendor costs (`ops`/`vendors`) rather than tracking money twice.
- AI categorization → `14` copilot.
