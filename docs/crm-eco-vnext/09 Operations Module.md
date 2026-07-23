# 09 — Operations Module

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Instead of static eligibility, build an **Integration Hub**: Eligibility Providers, API Connections, Mapping, Jobs, Retries, Failures, Logs, Import, Export, Transformation Rules, Scheduling, Queue Management, Webhooks, Versioning, Health Monitoring, Notifications, AI Diagnostics.

---

## Current State

Ops is **full** and dashboard-style.

- Hub `ops/page.tsx` + `ops/eligibility`, `ops/jobs` (history, search/filter/retry), `ops/scheduler` (CRUD), `ops/reports/age-up-out`, `ops/vendor/[vendor]`.
- Related: top-level `vendors/*` CRUD (credentials, schedules), and `documents` linked from the Ops nav section.
- Eligibility providers / vendor integrations drive jobs; retry + history present.

## Gap Analysis

| vNext area | Status |
|---|---|
| Eligibility providers | Present |
| Jobs / retries / history / logs | Present |
| Scheduling | Present (`ops/scheduler`) |
| Vendor config | Present (`vendors/*`) |
| Import / Export | Partial |
| Field mapping / transformation rules | Missing (generic mapping UI) |
| Queue management | Missing (no unified queue view) |
| Webhooks (inbound/outbound) | Missing |
| Connector versioning | Missing |
| Health monitoring / API health widget | Missing (ties to `01` dashboard) |
| AI diagnostics | Missing |

## Build Notes

- Generalize from "eligibility jobs" to a **connector abstraction**: one integration descriptor (auth, endpoints, mapping, schedule, retry policy) with adapters per provider. This is a deepening opportunity — today each vendor is semi-bespoke.
- Reuse the smart-mapping logic already in `apps/crm/src/lib/crm/import/smart-mapping.ts` for the transformation/mapping UI instead of writing a new mapper.
- Webhooks: define one inbound webhook receiver (HMAC-verified) + one outbound dispatcher, shared with billing (`05`) Authorize.Net webhook.
- Health monitoring feeds the dashboard "API Health"/"Scheduled Jobs" widgets (`01`).
- Queue management should surface the same job records the scheduler writes — one queue table, many views.
