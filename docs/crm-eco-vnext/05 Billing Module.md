# 05 — Billing Module

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Instead of a billing list, build **Enterprise Billing Engine**: Subscriptions, Invoices, Payment Methods, ACH, Credit Cards, Wallet, Retries, Dunning, Collections, Refunds, Credits, Payment Plans, Billing Calendar, Projected Billing, Revenue Forecasting, Failed Payments, AI Collections, AI Forecasting, Automation, Audit Trail.

---

## Current State

Billing is **full** but **fragmented across many bespoke pages**.

- Hub `billing/page.tsx` + `billing/transactions`, `.../list`, `.../schedules`, `.../failures`, `.../declined/today`, `.../summary`, `.../runs`, `.../invoices`, `.../payment-processors`.
- NACHA/ACH: `billing/nacha`, `.../export`, `.../import`.
- Price changes: `billing/price-changes{,/new,/[id]}`.
- Member billing tab: `apps/admin/src/components/billing/MemberBillingTab.tsx`, `BillingAutomation.tsx`.
- Services: `@crm-eco/lib/billing/billing-service.ts` (`BillingService`, ~850 lines — profiles, processPayment, refunds, schedules, retry backoff), `authorize-net.ts` (`AuthorizeNetService`). Stripe adapter exists but inactive.
- Tables: `payment_profiles`, `billing_schedules`, `billing_transactions`, `billing_failures`, `invoices`. Edge functions `process-billing`, `process-payment`.

## Gap Analysis

| vNext area | Status |
|---|---|
| Subscriptions / Schedules | Present (`billing_schedules`) |
| Credit Cards / ACH / Payment Methods | Present (Authorize.Net; NACHA) |
| Refunds / Retries / Failed Payments | Present (service + failures pages) |
| Audit Trail | Partial |
| Dunning / Collections | Missing (no attempt-1/2/3 dunning sequence) |
| Credits / Wallet | Missing |
| Payment Plans | Missing |
| Billing Calendar / Projected Billing | Partial (summary/runs) |
| Revenue Forecasting | Missing |
| AI Collections / AI Forecasting | Missing |
| Automated daily billing cron | Missing (edge fn exists, not scheduled/batched) |
| Retry processor consuming `next_retry_date` | Missing |
| Idempotency key on transactions | Missing |
| Authorize.Net webhook (HMAC) | Missing |

## Build Notes

- The engine core (`BillingService`) is solid — vNext work is **orchestration + surfacing**, not rewriting payment logic.
- Collapse the ~10 fragmented billing pages onto the shared list-view module (`02`); keep one billing "hub" + entity detail rather than a page per query.
- Dunning/collections → drive through the **workflow engine** (`19`) not bespoke code; each failed payment emits an event.
- Add idempotency + webhook HMAC before scaling billing volume (production-readiness blocker, see `23`).
- Forecasting/AI collections → `14` copilot + `10` reporting; feed from `billing_transactions` + `advisor_commission_summary`-style rollups.
- Resolve the **billing↔invoices overlap** (`billing/invoices` vs top-level `invoices/`) — pick one home (see `08`).
