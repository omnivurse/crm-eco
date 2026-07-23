# 22 — Logic Audit

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> **Review prompt.**

---

## Original Prompt (synthesized in package voice)

Perform a **logic/correctness audit**. Trace every workflow end-to-end: enrollment→billing→commission→payout, dunning, price changes, eligibility jobs. Verify calculations, state transitions, idempotency, race conditions, and tenant isolation in business logic (not just RLS). Identify dead code, broken workflows, and silent-failure paths.

---

## Current State

- Core money logic is centralized and reasonably tested-in-shape: `BillingService`, `CommissionService`, payout compliance, ledger triggers, advisory-lock batch creation.
- Known correctness gaps already catalogued in `docs/03_CRM_ECO_CURRENT_STATE.md` "Missing vs Saudemax" lists (billing crons, commission triggers, plan-change service).
- Recent fixes: RPC `search_path` hardening, Postgres `::numeric` cast fixes in actuarial RPCs.

## Gap Analysis (high-signal logic risks)

| Risk | Detail |
|---|---|
| Enrollment→commission not automatic | No trigger creates signup commission on approval |
| Billing retries | `billing_failures.next_retry_date` not consumed by a processor |
| Idempotency | Payment/mutation routes lack idempotency keys (double-charge risk) |
| Override accrual | `generateOverrides` exists but no scheduler invokes it |
| Cancellation cascade | No trigger cancels future billing / pending commissions on cancel |
| Dual entity sync | `members` ↔ `crm_records` sync paths can drift |
| Tenant checks in logic | Some routes rely on RLS alone; app-layer tenant assertion inconsistent |
| Dead components | Some CRM components historically unwired (verify before build) |

## Build Notes

- Prioritize **idempotency + cancellation cascades + retry processor** — these are financial-correctness blockers (also in `05`, `06`, `23`).
- Prefer routing cascades through the workflow engine (`19`) for traceability, keeping DB triggers only where atomicity is required.
- Add tenant-isolation assertions in the shared `withApi()` wrapper (`20`) so business logic can't accidentally cross tenants even if a query forgets a filter.
- Use the `qa-*` subagents (auth-rls, data-lifecycle, integrations) to mechanically probe isolation and write→read→display correctness.
