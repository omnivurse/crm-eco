# 03 — Members Module

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Instead of just "View Members", build **Member Management Enterprise**:

Dashboard, Member Timeline, Household, Dependents, Products, Plans, Enrollment, Eligibility, Billing, Invoices, Claims, Medical Sharing, Documents, Notes, Communications, Tasks, Appointments, Workflow, Automation, Audit History, HIPAA Access Log, Permissions, Portal, Electronic Signature, Custom Fields, Tags, Smart Lists, AI Summary, AI Health, AI Recommendations, AI Risk.

Every tab needs: forms, modals, bulk actions, history, permissions, workflow, automation, relationships, API endpoints, database tables, validation, notifications, audit logging. Repeat this methodology for every module.

---

## Current State

Members is the **most mature** module and the reference implementation for the whole platform.

- List: `apps/admin/src/app/(dashboard)/members/page.tsx` — search (incl. dependents RPC), advisor/status/market filters, saved views (`SavedViewsMenu`), pagination, bulk assign advisor (`BulkAssignBar`), CSV import (`members/import/page.tsx` via `ImportWizard`).
- Detail: `apps/admin/src/app/(dashboard)/members/[id]/page.tsx` → `MemberCommandCenter`. Tab set defined in `apps/admin/src/components/members/.../lib/member-command/types.ts`: overview, profile, household, dependents, enrollments, coverage, products, billing, invoices, payment-profiles, portal, documents, activity, audit, communication, tasks, notes, settings.
- Tables: `members`, `dependents`, `memberships`, `enrollments`, `billing_*`, `invoices`, `payment_profiles`, `enrollment_contracts`.

## Gap Analysis

| vNext tab | Status |
|---|---|
| Household / Dependents / Products / Plans / Enrollment / Coverage / Billing / Invoices / Payment Profiles / Portal | Present |
| Audit History | Present |
| Documents | Partial — tab shows `enrollment_contracts` only, not the full DMS from `13 Document Center.md` |
| Notes / Tasks / Communications | **Stubbed** — tabs exist but unwired |
| HIPAA Access Log | Missing in admin (exists CRM-side as `phi_access_log`) |
| Claims / Medical Sharing (Needs) | Missing — no Need entity surfaced in admin |
| Electronic Signature | Partial — signature pad exists in `@crm-eco/ui`; not wired to member docs |
| Tags / Smart Lists | Missing (saved views ≠ smart lists) |
| AI Summary / Health / Recommendations / Risk | Missing |
| Appointments | Missing |

## Build Notes

- Members already defines the **Command Center** pattern; the vNext job is to (a) wire the stub tabs, (b) swap the ad-hoc tabs onto the shared mixins from `02 Navigation Framework.md` (Notes/Docs/Timeline/Audit/AI), and (c) add the missing Need/Sharing surface.
- Notes/Tasks/Communications should consume the **unified** notes/tasks/notification services (see `13`, `15`, and the architecture review) rather than admin-local tables — this is where the admin↔CRM duplication gets resolved.
- HIPAA Access Log: reuse CRM's `apps/crm/src/lib/security/audit.ts` (`phi_access_log`) — do not create a second PHI log.
- AI tabs: implement against the per-module copilot contract from `14 AI Assistant.md`.
- Preserve members as the "golden" example; when the shared scaffold from `02` is ready, refactor members onto it to prove the abstraction (deletion test).
