# CRM-ECO vNext — Master Build Prompt Package

A build-planning suite for evolving CRM-ECO into a configurable, multi-tenant,
HIPAA/SOC2-aware, AI-native, workflow-first enterprise enrollment platform that
exceeds Salesforce Health Cloud / Zoho / HubSpot / AgencyBloc.

**This package is a specification + gap analysis, not code.** No app/package code is
changed by reading it. Each file pairs the original build prompt with a grounded
**Current State**, **Gap Analysis**, and **Build Notes** section so future agents
build the *missing* pieces instead of rebuilding what already ships.

> Domain vocabulary is anchored in [`/CONTEXT.md`](../../CONTEXT.md). Architecture
> vocabulary (module, interface, depth, seam, adapter) comes from the
> `/codebase-design` skill. An architecture review of the deepening opportunities is
> generated separately as a standalone HTML report.

---

## The big picture

CRM-ECO is **~80% built, unevenly deep**. 13 of ~16 admin modules are functionally
"full". The gap between today and the vNext vision is **not missing modules** — it is
**missing platform layers** and **duplicated infrastructure**:

- No shared list-view / resource scaffold → every list page is bespoke.
- Documents, tenant resolvers, members, and notifications each exist in 2–3 forks.
- Automation, workflow, sequences, and AI are powerful but **CRM-app-only**.
- The permission catalog exists but enforcement is scattered role-string checks.

So vNext is mostly a **consolidation + platformization** effort, sequenced below.

---

## Recommended build order

Build foundations before modules; build the backbone before polishing pages.

### Phase 0 — Foundations (unblock everything else)
1. [`16 Security Permissions.md`](./16%20Security%20Permissions.md) — one permission gate
2. [`18 Database Architecture.md`](./18%20Database%20Architecture.md) — canonical entity model + domain events
3. [`17 Tenant Configuration.md`](./17%20Tenant%20Configuration.md) — config-as-data, unified tenant resolver
4. [`20 API Layer.md`](./20%20API%20Layer.md) — one `withApi()` wrapper

### Phase 1 — Backbone (the multiplier)
5. [`02 Navigation Framework.md`](./02%20Navigation%20Framework.md) — shared list-view + resource scaffold + shared tab mixins
6. [`12 Automation Engine.md`](./12%20Automation%20Engine.md) + [`19 Workflow Engine.md`](./19%20Workflow%20Engine.md) — extract CRM engines into a shared package
7. [`13 Document Center.md`](./13%20Document%20Center.md) + [`15 Notification Center.md`](./15%20Notification%20Center.md) — de-fork shared infrastructure

### Phase 2 — Experience layers
8. [`01 Dashboard Prompt.md`](./01%20Dashboard%20Prompt.md) — configurable widget system
9. [`14 AI Assistant.md`](./14%20AI%20Assistant.md) — per-module copilot contract
10. [`11 Email Center.md`](./11%20Email%20Center.md) — channel abstraction + shared sequences
11. [`10 Reporting Engine.md`](./10%20Reporting%20Engine.md) — unified BI surface

### Phase 3 — Module deep-dives (mostly wiring gaps onto the backbone)
12. [`03 Members Module.md`](./03%20Members%20Module.md) *(reference implementation)*
13. [`04 Agents Module.md`](./04%20Agents%20Module.md)
14. [`05 Billing Module.md`](./05%20Billing%20Module.md)
15. [`06 Commissions Module.md`](./06%20Commissions%20Module.md)
16. [`07 Payables Module.md`](./07%20Payables%20Module.md)
17. [`08 Invoices Module.md`](./08%20Invoices%20Module.md)
18. [`09 Operations Module.md`](./09%20Operations%20Module.md)

### Phase 4 — Review gates (run repeatedly)
19. [`21 UX Review.md`](./21%20UX%20Review.md)
20. [`22 Logic Audit.md`](./22%20Logic%20Audit.md)
21. [`23 Production Readiness.md`](./23%20Production%20Readiness.md)
22. [`Final Enterprise Audit.md`](./Final%20Enterprise%20Audit.md) — capstone; re-run after each increment

Reference: [`00 Master System Architecture Prompt.md`](./00%20Master%20System%20Architecture%20Prompt.md) frames the whole effort.

---

## Full file index

| # | File | Type | Module maturity today |
|---|---|---|---|
| 00 | Master System Architecture Prompt | Reference | — |
| 01 | Dashboard Prompt | Experience | Partial (widgets exist, no system) |
| 02 | Navigation Framework | **Backbone** | Weak (bespoke per page) |
| 03 | Members Module | Module | **Full** (reference) |
| 04 | Agents Module | Module | Full |
| 05 | Billing Module | Module | Full (fragmented) |
| 06 | Commissions Module | Module | Full (deep data) |
| 07 | Payables Module | Module | Full (bespoke) |
| 08 | Invoices Module | Module | Full (thin detail) |
| 09 | Operations Module | Module | Full |
| 10 | Reporting Engine | Experience | Full (template-only) |
| 11 | Email Center | Experience | Full (email-only) |
| 12 | Automation Engine | Backbone | Full (CRM-only) |
| 13 | Document Center | Backbone | Full (forked) |
| 14 | AI Assistant | Experience | Partial (CRM point features) |
| 15 | Notification Center | Backbone | Full (3 forks) |
| 16 | Security Permissions | **Foundation** | Partial (enforcement scattered) |
| 17 | Tenant Configuration | **Foundation** | Partial |
| 18 | Database Architecture | **Foundation** | Strong (some dupes) |
| 19 | Workflow Engine | Backbone | Full (CRM-only) |
| 20 | API Layer | **Foundation** | Partial (inconsistent) |
| 21 | UX Review | Review | — |
| 22 | Logic Audit | Review | — |
| 23 | Production Readiness | Review | — |
| — | Final Enterprise Audit | Review (capstone) | — |

---

## Cross-cutting deepening candidates

The architecture review identified six consolidations that convert duplicated,
shallow code into deep shared modules. In priority order:

1. **Shared list-view / DataTable module** → powers `02` (Strong)
2. **Documents module extraction** (admin/CRM de-fork) → `13` (Strong)
3. **Unified permission gate** over `crm_permissions` → `16` (Strong)
4. **Tenant resolver consolidation** into `@crm-eco/lib/tenant` → `17` (Worth exploring)
5. **Notification abstraction** over 3 tables → `15` (Worth exploring)
6. **`withApi()` auth wrapper** → `20` (Worth exploring)

See the generated HTML report for before/after diagrams and the deletion-test
rationale for each.

---

## How to use a prompt file

1. Read the **Current State** so you don't rebuild working code.
2. Read the **Gap Analysis** for the concrete to-do list.
3. Follow **Build Notes** for which shared package/seam to use and what to
   consolidate rather than create.
4. Record load-bearing decisions as ADRs in `docs/adr/`.
5. Update the file's Current State when the gap closes.
