# 08 — Invoices Module

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (synthesized in package voice)

Build **Enterprise Invoicing**: individual + group invoice generation, retro invoicing, invoice templates, line items, taxes/fees, PDF generation, delivery (email/portal), payment application, credit notes, aging/AR, dunning hooks, exports, and full audit. Invoices must share one home with Billing, not duplicate it.

---

## Current State

Invoices is **full** on generation, thin on detail.

- Pages: `invoices/page.tsx` (search, status/retro filters, detail modal, send, CSV export), `invoices/generate/individual`, `invoices/generate/group`, `invoices/groups/page.tsx`, `invoices/retro/page.tsx`.
- Overlap: `billing/invoices/page.tsx` renders a billing-scoped invoice surface too.
- Table: `invoices` (auto `INV-YYYY-XXXXXX`, `balance_due` generated, `line_items` jsonb, `pdf_url`, statuses draft→paid→void).

## Gap Analysis

| vNext area | Status |
|---|---|
| Individual / Group generation | Present |
| Retro invoicing | Present |
| Groups membership mgmt | Present |
| Send via email | Present |
| Export | Present |
| Dedicated `/invoices/[id]` route | Missing (modal only) |
| PDF generation | Missing (`pdf_url` column unused) |
| Aging / AR report | Missing |
| Credit notes | Missing |
| Templates | Missing |
| Duplicate surface under billing | **Yes — needs consolidation** |

## Build Notes

- Decide the single home: **top-level `invoices/`** owns the entity; `billing/invoices` becomes a filtered view/link into it (removes duplication). Record as an ADR.
- Add the detail route via the shared resource scaffold (`02`); retire the modal-only detail.
- PDF generation → shared service (reuse whatever `13 Document Center.md` uses) writing to `invoices.pdf_url`.
- Aging/AR → `10 Reporting Engine.md`.
- Dunning hooks fire into the workflow engine (`19`), shared with billing collections (`05`).
