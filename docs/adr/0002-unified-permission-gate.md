# ADR 0002 — Unified Permission Gate

- **Status:** Accepted (lib + admin CanProvider shipped; migration `202607220001_has_org_permission.sql` pending prod apply)
- **Date:** 2026-07-22

- **Deciders:** Platform architecture (CRM-ECO vNext)
- **Related:** `docs/crm-eco-vnext/designs/candidate-03-permission-gate.md`,
  `docs/crm-eco-vnext/16 Security Permissions.md`, ADR 0001 (list-view `useCan` seam),
  architecture review Candidate 3

## Context

The platform has a fine-grained permission catalog (`crm_permissions` + role maps) and
a DB helper `has_crm_permission(user_id, key)`, but runtime enforcement is scattered
role-string checks (`requireAdminRole`, `has_crm_role`, inline `crm_role` arrays).
`has_crm_permission` is also **not organization-scoped**, which is unsafe for
multi-tenant use.

Candidate 1's Shared List-View module already accepts `permission` keys on row/bulk
actions and evaluates them through `useCan()` / `CanProvider` (currently always
`true`). Payables pilot uses `payables.approve` and `payables.pay`.

## Decision

Introduce a **unified permission gate**:

1. Add org-scoped RPC `has_org_permission(org_id, permission_key)` (SECURITY DEFINER,
   `SET search_path = public`), with super-admin short-circuit and an explicit
   **legacy org-role bridge** so owner/admin/staff keep working before every user is
   on `crm_user_roles`.
2. Ship `@crm-eco/lib/permissions` with `requirePermission`, `hasPermission`,
   `listPermissions`, and a `Permissions` key catalog.
3. Bootstrap the client permission set once per active org and feed
   `CanProvider` in the admin (then CRM) shell — ResourceList actions inherit
   enforcement with no descriptor changes.
4. Migrate call sites strangler-style: new code uses permission keys; old
   role-string checks are replaced module-by-module. Deprecate direct use of
   `has_crm_permission` for new work.

RLS remains the last line of defense; the app gate is the first. Fail closed.

## Consequences

**Positive**
- One authorization vocabulary across UI and API.
- C1 list actions become real security controls without further UI work.
- Unblocks Candidate 6 (`withApi({ permission })`) and role-based dashboard widgets.
- Catalog + security-control UI already exist — we enforce what we already model.

**Negative / costs**
- Requires a Tier 1+ migration for `has_org_permission` + seed keys (prod apply needs
  explicit approval).
- Bridge logic must be carefully tested so it neither over-grants nor locks out admins.
- Temporary dual path (role bridge + catalog) until assignment coverage is complete.

## Alternatives considered

1. **Keep role-string checks** — rejected: blocks C1 action gating and grows drift.
2. **Use existing `has_crm_permission` as-is** — rejected: not org-scoped.
3. **Authz only in RLS** — rejected: UI still needs a permission set; RLS cannot
   drive button visibility cleanly; defense-in-depth requires both.

## Migration (strangler)

RPC + seed → `@crm-eco/lib/permissions` → admin `CanProvider` (payables lights up) →
pilot API routes → CRM gradual migration → compose into `withApi()`.

## Follow-ups

- ADR for `withApi()` (Candidate 6) once this gate is stable.
- Removal criterion for the org-role bridge (document when 100% of active users are
  on `crm_user_roles` for their orgs).
