# 06 — Commissions Module

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (synthesized in package voice)

Instead of a commissions list, build the **Enterprise Commission Engine**: Plan Rates, Agent Levels/Tiers, Signup/Monthly/Override calculation, Upline distribution, Ledger, Adjustments, Bonuses, Clawbacks/Chargebacks, Payout Batches, Statements, Compliance Holds, Forecasting, AI anomaly/fraud detection, full Audit Trail. Every calculation must be reproducible, tenant-isolated, and traceable from enrollment → commission → ledger → payout.

---

## Current State

Commissions is **full** and unusually deep on the data/service side.

- Pages: `commissions/page.tsx` (hub), `.../list`, `.../summary`, `.../transactions`, `.../runs`, `.../tiers{,/new,/[id]}`, `.../payouts{,/[batchId]}`.
- Service: `@crm-eco/lib/commissions/commission-service.ts` (`getAdvisorTier`, `calculateCommission`, `createCommissionTransaction`, `generateOverrides` via `get_advisor_upline`), plus `payout-compliance.ts`.
- Tables: `agent_levels`, `commission_rates`, `commissions`, `commission_adjustments`, `advisor_commission_summary`, `commission_payment_batches`, `commission_payouts`, `commission_ledger`, `payout_item_ledger_links`.
- DB functions: `calculate_enrollment_commission`, `get_advisor_upline`, `get_advisor_downline_count`, `trg_commission_to_ledger`, `create_payout_batch` (advisory-lock protected).
- CRM APIs add fraud-flags, reversals, anomalies, reconcile, audit under `/api/commissions/*`.

## Gap Analysis

| vNext area | Status |
|---|---|
| Rates / Tiers | Present (CRUD) |
| Calculation + overrides | Present (service + RPCs) |
| Ledger | Present (`commission_ledger` + trigger) |
| Payout batches | Present (RPC + APIs; UI partial) |
| Adjustments / Bonuses | Table present; **UI not wired** |
| Clawbacks / Chargebacks | Partial |
| Signup commission on enrollment-approved | **No DB trigger** (manual) |
| Monthly accrual cron | Missing (`calculateCommission` not scheduled) |
| Override generation job | Exists but **not invoked by any scheduler** |
| Fraud/anomaly AI | Partial (CRM APIs exist) |
| Statements / forecasting | Missing |
| Full payout lifecycle UI | Partial |

## Build Notes

- The math is done; the gaps are **triggers, schedulers, and UI wiring**. Add: enrollment-approved → signup commission trigger; a monthly accrual + override cron (route through `19` workflow engine / cron).
- Wire the existing `commission_adjustments` table to an admin UI (bonuses/clawbacks) — no new schema needed.
- Complete the payout batch lifecycle UI on top of the existing `create_payout_batch` RPC and payout providers (`apps/crm/src/lib/payouts/providers/*`).
- Fold `commissions/list` and `commissions/hub` overlap into the shared list-view module (`02`).
- Consolidate CRM-side and admin-side commission APIs behind one service to avoid divergence.
