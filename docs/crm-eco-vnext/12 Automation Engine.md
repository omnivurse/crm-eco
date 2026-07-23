# 12 — Automation Engine

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> Closely related to `19 Workflow Engine.md` — 12 is the rules/trigger layer, 19 is the process/state-machine layer.

---

## Original Prompt (synthesized in package voice)

Every action in CRM-ECO should be automatable. Build a tenant-scoped **Automation Engine**: triggers (record events, schedules, webhooks), conditions, actions (update, notify, assign, email, create task, call webhook, run AI), assignment rules, lead/record scoring, cadences/macros, run history, and error handling. Automations must be authored in the UI, versioned, and audited.

---

## Current State

A real automation engine **already exists — CRM-only**.

- `apps/crm/src/lib/automation/`: `engine.ts`, `actions.ts`, `conditions.ts`, `assignment.ts`, `scoring.ts`, `cadence.ts`, `macros.ts`, `scheduler.ts`.
- UI: `apps/crm/src/app/crm/settings/automations/*` (workflows, macros, SLA, scoring, runs, approvals).
- APIs: `/api/automation/*`, `/api/workflows/*`.
- DB: `crm_workflow_automation_engine` + `automation_engine_runtime_tables` migrations.
- Admin has a lighter `settings/automations/page.tsx` but **no engine** behind it.

## Gap Analysis

| vNext area | Status |
|---|---|
| Triggers / conditions / actions | Present (CRM) |
| Assignment / scoring / cadence / macros | Present (CRM) |
| Run history | Present (CRM) |
| Availability to admin app | **Missing** — engine is CRM-scoped |
| Webhook trigger/action | Partial |
| AI action | Partial |
| Versioning of automations | Missing |
| Cross-module event bus | Missing (no shared "domain event" stream) |

## Build Notes

- The deep move: **extract the automation engine into a shared package** (`@crm-eco/automation`) so admin billing/commissions/enrollment can emit events and run rules — this is the "workflow-first" vNext principle.
- Introduce a shared **domain event** contract (`entity_type`, `entity_id`, `event`, `payload`, `organization_id`) that both apps publish to; the engine subscribes. This decouples producers from the engine (a clean seam).
- Keep authoring UI in one place; render tenant-scoped rule lists in each app.
- Route billing dunning (`05`), commission accrual (`06`), invoice/AR (`08`), and notifications (`15`) through this engine rather than bespoke cron code.
