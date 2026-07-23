# 02 — Navigation Framework

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Build every navigation item. Every navigation item must have: List View, Search, Filters, Advanced Filters, Bulk Actions, Create, Edit, Delete, Archive, Restore, Export, Import, Permissions, History, Audit Log, AI Assistant, Notes, Documents, Timeline, Related Records. Every navigation item should follow the exact same design language.

---

## Current State

Navigation is defined in `apps/admin/src/components/layout/AdminSidebar.tsx` as a static `navSections` array (sections: Main, Products, Enrollment, Billing, Commissions, Operations, Communications, Analytics, Settings). Collapsed-section state persists to `localStorage`. Layout shell: `apps/admin/src/components/layout/AdminShell.tsx`, top nav `AdminTopNav.tsx`, breadcrumbs `Breadcrumbs.tsx`, org switch `OrganizationSwitcher.tsx`.

Each nav destination is a **bespoke page**. The prompt's "every item has the same 20 capabilities" is currently true for *no* module — capabilities are implemented ad hoc:

- `PageHeader` is the only broadly shared chrome.
- `ImportWizard` is shared by members + agents only.
- Search/filter/export logic is re-implemented inline on nearly every list page (billing, payables, invoices, commissions are 500–900-line client pages).
- Notes/Documents/Timeline/Audit/AI are present on **members** (command center) but stubbed or absent elsewhere.

## Gap Analysis

The 20 required per-item capabilities, coverage today (admin):

| Capability | Where it exists | Where it's missing |
|---|---|---|
| List View | Everywhere | — |
| Search | members, billing txns, commissions | agents list, enrollments list, organizations, notifications |
| Filters / Advanced Filters | members (saved views), commissions | most others; no shared advanced-filter builder |
| Bulk Actions | members (assign advisor) | almost everywhere else |
| Create/Edit | members, agents, products, payables, commissions/tiers | organizations (read-only) |
| Delete/Archive/Restore | partial (payables delete) | no consistent soft-delete/restore pattern |
| Export | reports (`ExportButton`), inline CSV on some | no shared export |
| Import | members, agents (`ImportWizard`) | most others |
| Permissions | role gate on routes | not per-record/per-action |
| History / Audit Log | members, enrollments, documents, settings | most others |
| AI Assistant | none in admin | all |
| Notes | members (stubbed) | all |
| Documents | documents module, members (contracts only) | all others |
| Timeline | members activity | all others |
| Related Records | members, agents | all others |

## Build Notes

- This is the **backbone** prompt. Build a shared **module scaffold** (a "resource" abstraction): given a resource descriptor (table, columns, filters, actions, permissions, tabs), render list + detail + create/edit with the full capability set. This is the single highest-leverage deepening in the whole package.
- Pair it with the shared **DataTable / list-view module** (architecture review, Candidate 1) so search/filter/sort/paginate/export/bulk are implemented once.
- Reuse the **Command Center** tab pattern from members (`lib/member-command/types.ts`) as the detail-view standard for every entity.
- Notes/Documents/Timeline/Audit/AI tabs should be **shared mixins** bound to `(entity_type, entity_id)` so any resource gets them for free — this is the "unified entity model" vNext principle.
- Keep the sidebar data-driven: move `navSections` to tenant/role-aware config so nav itself becomes configurable (ties to `17 Tenant Configuration.md`).
