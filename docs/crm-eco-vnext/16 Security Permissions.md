# 16 — Security & Permissions

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> **Foundation prompt — build/consolidate before module deep-dives.**

---

## Original Prompt (synthesized in package voice)

Build enterprise **Security & Permissions**: role hierarchy, a fine-grained permission catalog (resource × action), per-record ACLs where needed, one enforcement path (middleware/guard) used by every route and UI, HIPAA PHI access controls + audit, SOC2-aligned session/auth logging, and tenant isolation guarantees. Permissions must be data-driven and testable.

---

## Current State

Strong primitives, **inconsistent enforcement**.

- Two role systems: org membership roles (`owner`, `super_admin`, `admin`, `staff`, `read_only` in `organization_members`; `TenantRole` in `packages/lib/src/tenant/constants.ts`) and CRM app roles (`profiles.crm_role`, gated by `has_crm_role(org_id, roles[])` RPC).
- Fine-grained catalog **exists but is underused**: `crm_roles`, `crm_permissions`, `crm_role_permissions`, `crm_user_roles` (migration `202603110006_crm_security_control.sql`) with CRUD APIs (`/api/crm/security/permissions`, `/roles`).
- Helpers: admin `requireAdminRole()` (`apps/admin/src/lib/auth.ts`), CRM `getAuthProfile()`, `require-crm-role.ts`.
- RLS helpers (SECURITY DEFINER): `get_user_organization_id()`, `user_organization_ids()`, `user_role_in()`, `has_crm_role()`.
- Audit: unified (`unified_audit_logs`, hash-chained), PHI (`phi_access_log`), auth logging (`/api/auth/log`).

## Gap Analysis

| vNext area | Status |
|---|---|
| Role hierarchy (org + app) | Present |
| RLS tenant isolation | Present (strong) |
| Fine-grained permission catalog | **Schema present, enforcement scattered** |
| Single enforcement path | **Missing** — ~300 CRM routes use inline `includes(crm_role)`; admin mixes `requireAdminRole` + inline tenant checks |
| Per-record ACL | Missing |
| PHI access controls + audit | Present (CRM) |
| Auth/session logging (SOC2) | Present |

## Build Notes

- **The deep move (architecture review, Candidate 3): one `requirePermission(permissionKey)` gate** backed by `crm_permissions`, replacing scattered role-string checks. Roles map to permission sets; code checks permission keys, not role names.
- Provide both a server guard (API routes) and a client hook (`useCan(permission)`) from the same source of truth.
- Do not add a third role system — reconcile org roles ↔ CRM roles into one catalog.
- Keep RLS as the last line of defense; the app gate is the first. Never rely on UI hiding alone.
- Every privileged action (including AI actions, `14`) audits to `unified_audit_logs`.
- This prompt unblocks `01` (role-based widgets), `02` (per-action permissions), `13` (document access), and `20` (API auth).
