# 19 — Workflow Engine

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> Sibling to `12 Automation Engine.md`: 12 is rules/triggers; 19 is process/state-machines/approvals/SLAs.

---

## Original Prompt (synthesized in package voice)

Build a tenant-scoped **Workflow Engine**: configurable multi-step processes, state machines (blueprints), approval chains, SLA timers/escalations, task generation, human-in-the-loop steps, and run history. Every major entity transition (enrollment approval, payout approval, price change, payable approval) should be expressible as a workflow.

---

## Current State

CRM has substantial workflow machinery; admin has ad-hoc approvals.

- Blueprints / stage transitions: `apps/crm/src/lib/blueprints/` + blueprint-transition APIs.
- Approvals: `apps/crm/src/lib/approvals/` + `/api/approvals/*` + UI `settings/automations/approvals`.
- SLA + scoring + runs: `settings/automations/*`.
- Playbooks: `/api/playbooks/`.
- Admin-side transitions are bespoke: enrollment approve/reject (`EnrollmentActions`), price-change flow, payout batch approval (`create_payout_batch` RPC).

## Gap Analysis

| vNext area | Status |
|---|---|
| Blueprints / state machines | Present (CRM) |
| Approval chains | Present (CRM) |
| SLA timers / escalation | Present (CRM) |
| Playbooks | Present (CRM) |
| Availability to admin transitions | **Missing** — enrollment/payout/price-change approvals are hand-coded |
| Enrollment→billing→commission cascade as workflow | Missing (today via triggers/manual) |
| Run history visibility in admin | Missing |

## Build Notes

- Reuse, don't rebuild: **share the CRM approvals/blueprint engine** (extract alongside `12`) so admin approvals (payouts, price changes, payables) run through it.
- Model the enrollment lifecycle (draft→approved→membership→billing schedule→signup commission) as **one workflow** with steps that emit domain events, replacing scattered triggers where clarity improves. Keep DB triggers only where atomicity demands it; record the split as an ADR.
- Approval chains consume the permission gate (`16`) to decide who can approve.
- SLA escalations emit notifications (`15`).
- Expose run history in admin via the shared list-view module (`02`).
