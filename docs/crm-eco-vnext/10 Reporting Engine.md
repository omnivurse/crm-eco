# 10 — Reporting Engine

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Instead of "Member Reports", create **Enterprise BI Platform**: Saved Reports, Custom Reports, Dashboard Builder, SQL Builder, Report Templates, Scheduling, Exports, Charts, KPIs, Forecasting, Data Warehouse, Snapshots, AI Insights, Executive Reporting.

---

## Current State

Reports is **full** for template-driven reporting.

- Pages: `reports/page.tsx`, `reports/templates{,/[id]}`, `reports/saved{,/[id]}`. Template catalog from `@crm-eco/shared`; save/run, date filters, results table, `ExportButton` (`@crm-eco/ui`), favorites.
- Separate analytics live under `analytics/*`: `analytics/funnel`, `analytics/demographics`, `analytics/actuarial` (RPC-backed, de-identified aggregates), plus `docs/actuarial/` tooling.

## Gap Analysis

| vNext area | Status |
|---|---|
| Report templates + saved runs | Present |
| Exports | Present |
| Charts / KPIs | Partial (analytics pages, dashboard) |
| Scheduling (emailed reports) | Missing |
| Custom report / SQL builder | Missing |
| Dashboard builder | Missing (ties to `01`) |
| Forecasting | Missing |
| Data warehouse / snapshots | Missing (all live queries) |
| AI insights | Missing |
| Executive reporting | Partial (dashboard KPIs) |

## Build Notes

- Unify the split: **reports + analytics under one BI surface**. Today `reports/*` and `analytics/*` are separate trees with separate mental models.
- The de-identified actuarial/demographics RPCs (`supabase/migrations` `get_group_demographics`, `get_actuarial_experience`) are a strong pattern — extend that "aggregate-only SECURITY DEFINER" approach for any new report to stay HIPAA-safe.
- Scheduling → workflow engine (`19`) + email center (`11`).
- Snapshots: add periodic rollup tables (like `advisor_commission_summary`) rather than a full warehouse initially.
- AI insights → `14` copilot summarizing report output.
- Reuse `ExportButton` and the shared list-view export path; don't add another CSV builder.
