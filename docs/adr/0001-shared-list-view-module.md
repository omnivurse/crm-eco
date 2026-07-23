# ADR 0001 — Shared List-View (DataTable) Module

- **Status:** Accepted (pilot implemented — `@crm-eco/ui/data-table` + payables)
- **Date:** 2026-07-22
- **Deciders:** Platform architecture (CRM-ECO vNext)
- **Related:** `docs/crm-eco-vnext/designs/candidate-01-shared-list-view.md`,
  `docs/crm-eco-vnext/02 Navigation Framework.md`, architecture review (deepening Candidate 1)

## Context

Admin list pages each re-implement search, filter, sort, pagination, export, and
row/bulk actions inline (e.g. `apps/admin/src/app/(dashboard)/payables/page.tsx`,
913 lines). The CRM app already contains the deep versions of these features
(`useColumnResize`, `FilterBuilder`, `saved_views`, a virtualized `RecordTable`), but
they are trapped in `apps/crm`. `02 Navigation Framework.md` requires that every
navigable resource share the same capabilities — impossible without a shared module.

The duplication also hides defects: several pages paginate client-side over a capped
`.limit(500)` fetch, silently dropping rows for larger tenants.

## Decision

Create a domain-agnostic **shared list-view module** exposing a small interface — a
`ResourceDescriptor<Row>` config plus a `<ResourceList>` component and a headless
`useResourceList` hook — in `@crm-eco/ui/data-table`, backed by a single Supabase
query builder in `@crm-eco/lib/data-table`. A `DataSource` adapter (`supabase` |
`fetcher`) abstracts client-direct vs API-route data access. Filter/sort/paginate run
server-side by default.

We will **absorb, not duplicate**, the existing CRM assets: move `useColumnResize`
into the module, lift `FilterBuilder`/`ViewFilter`, and reuse the `saved_views` table
and API (generalizing its per-context types to `SavedView<TFilters>`).

Row/bulk actions carry an optional `permission` key evaluated via an injected
`useCan()` seam so the module composes with the future permission gate (ADR/Candidate
3) without call-site changes.

## Consequences

**Positive**
- `02 Navigation Framework` becomes achievable; every list gains parity by construction.
- Large net line deletion (payables ~913 → ~150; target ≥3,000 lines across first five pages).
- Fixes server-pagination truncation bugs.
- CRM's best list UX becomes the platform default; CRM migrates onto the shared module too.

**Negative / costs**
- Up-front module build before any page benefits.
- Migration touches financial pages (billing, commissions) — mitigated by piloting on
  payables and shipping one page at a time.
- Risk of over-abstraction — mitigated by the deletion test and the headless hook split.

## Alternatives considered

1. **Keep per-page implementations** — rejected: guarantees continued drift and blocks `02`.
2. **Adopt a third-party datagrid wholesale (e.g. AG Grid)** — rejected for the core:
   heavy, styling/RLS/saved-view integration cost, and we already own equivalent
   pieces; we may still use `@tanstack/react-virtual` (already a dependency) for
   opt-in virtualization.
3. **Generalize CRM `RecordTable` in place** — rejected: it is 1601 lines coupled to
   `crm_records`/`crm_fields`; extracting a clean interface is cleaner than retrofitting.

## Migration (strangler)

Build module → pilot payables (deletion-test proof) → billing/transactions, invoices,
commissions/list, agents → members last (hardest) → delete inline logic per page.

## Follow-ups

- ADR for the resource **detail/create scaffold** (rest of `02`).
- ADR for the **unified permission gate** (Candidate 3 / `16`) that provides `useCan()`.
