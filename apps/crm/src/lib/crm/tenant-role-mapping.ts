/**
 * Effective CRM role for a membership role in the ACTIVE organization.
 *
 * Mirrors step 3 of the `has_crm_role(p_org_id, p_roles)` RPC
 * (supabase/migrations/00000000000000_baseline.sql:13581), which is what RLS
 * itself enforces:
 *
 *   role IN ('owner','super_admin','admin')                       -- any CRM role
 *   OR (role = 'staff'     AND p_roles ∩ {crm_agent, crm_viewer})
 *   OR (role = 'read_only' AND p_roles ∋ crm_viewer)
 *
 * Kept in its own module (rather than beside `getAuthProfile`) so it stays a
 * pure function that can be unit-tested without pulling in `next/headers`.
 *
 * Keep in sync with `has_crm_role`. Anything unrecognised maps to null — no CRM
 * access — rather than guessing upward.
 */
export function crmRoleForTenantRole(tenantRole: string): string | null {
  switch (tenantRole) {
    case 'owner':
    case 'super_admin':
    case 'admin':
      return 'crm_admin';
    case 'staff':
      return 'crm_agent';
    case 'read_only':
      return 'crm_viewer';
    default:
      return null;
  }
}
