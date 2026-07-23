# 01 — Dashboard Builder

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Design the enterprise enrollment dashboard. Do not build a static dashboard. Build a configurable widget system.

Widgets include: Today's Tasks, Notifications, Pending Applications, Pending Billing, Recent Activity, Today's Calls, Upcoming Renewals, Today's Appointments, Recently Viewed Members, Workflow Queue, Documents Awaiting Signature, Recent Billing, Recent Payments, Agent Activity, Commission Summary, Sales Funnel, Enrollment Funnel, Member Growth, Retention, Persistency, Revenue, Collections, Open Tickets, Support Queue, Automation Status, Scheduled Jobs, API Health, Server Status, System Alerts, Import Queue, Export Queue, Email Queue, SMS Queue, AI Insights, Executive KPI Dashboard.

Everything should be drag-and-drop. Resizable. Role-based. Tenant configurable. Persisted per user. Realtime.

---

## Current State

`apps/admin/src/app/(dashboard)/dashboard/page.tsx` renders a **live but hard-coded** console. Widgets exist as fixed components in `apps/admin/src/components/dashboard/*`:

- KPI/stat cards (`StatCard`, `CrmKpiCards`), `AdminWorkQueue`, enrollment/sales funnel, commission summary, future enrollments, member activity feed, `TodoListWidget`, scheduled-jobs and recently-viewed-pages widgets, quick-action links.

So roughly 12–15 of the requested widget *concepts* already have real implementations pulling live data. What is missing is the **system** around them.

## Gap Analysis

| Capability | Status |
|---|---|
| Widgets pulling live tenant data | Present (partial set) |
| Drag-and-drop layout | Missing |
| Resizable widgets | Missing |
| Per-user persisted layout | Missing |
| Role-based widget visibility | Missing (dashboard is same for all admin roles) |
| Tenant-configurable default layout | Missing |
| Realtime updates | Partial (some widgets fetch; no subscription layer) |
| Widget catalog / registry | Missing |
| Missing widget concepts | SMS queue, API/server health, support/ticket queue, persistency, export queue |

## Build Notes

- The deep move here is a **widget registry + layout module**, not 35 more one-off components. Define one `Widget` interface (id, title, roles[], size constraints, data-loader, render). Persist layout as JSON per `(user_id, organization_id)`; seed defaults per role/plan from tenant config (`17 Tenant Configuration.md`).
- Reuse existing widgets by wrapping them to the `Widget` interface rather than rewriting.
- Use a maintained grid lib (e.g. `react-grid-layout`) for drag/resize; do not hand-roll.
- Realtime: layer Supabase realtime/React Query invalidation behind the widget data-loader so individual widgets stay dumb.
- Role gating must consume the unified permission gate from `16 Security Permissions.md`, not ad-hoc role strings.
- This module is a prime **deepening candidate** — see the architecture review report ("configurable surface" theme).
