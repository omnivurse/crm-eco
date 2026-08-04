import { describe, it, expect } from 'vitest';
import { crmRoleForTenantRole } from './tenant-role-mapping';

/**
 * `crmRoleForTenantRole` decides what CRM rights a user gets in an org they
 * reached by tenant switching. It must agree with step 3 of the `has_crm_role`
 * RPC (supabase/migrations/00000000000000_baseline.sql:13581), which is what RLS
 * enforces:
 *
 *   role IN ('owner','super_admin','admin')                       -- any CRM role
 *   OR (role = 'staff'     AND p_roles ∩ {crm_agent, crm_viewer})
 *   OR (role = 'read_only' AND p_roles ∋ crm_viewer)
 *
 * If the two drift, the app and the database disagree about who may do what —
 * exactly the class of bug this mapping was introduced to close.
 */
describe('crmRoleForTenantRole', () => {
  it('maps admin-tier membership roles to crm_admin', () => {
    expect(crmRoleForTenantRole('owner')).toBe('crm_admin');
    expect(crmRoleForTenantRole('super_admin')).toBe('crm_admin');
    expect(crmRoleForTenantRole('admin')).toBe('crm_admin');
  });

  it('maps staff to crm_agent, not crm_admin', () => {
    // has_crm_role grants staff only crm_agent/crm_viewer. Returning crm_admin
    // here would let a staff member of a foreign tenant pass admin-only route
    // gates that hold a service-role client.
    expect(crmRoleForTenantRole('staff')).toBe('crm_agent');
  });

  it('maps read_only to crm_viewer', () => {
    expect(crmRoleForTenantRole('read_only')).toBe('crm_viewer');
  });

  it('denies rather than guesses for unknown roles', () => {
    // Fail closed: a role added to organization_members but not yet mapped here
    // must grant nothing.
    expect(crmRoleForTenantRole('member')).toBeNull();
    expect(crmRoleForTenantRole('advisor')).toBeNull();
    expect(crmRoleForTenantRole('')).toBeNull();
    expect(crmRoleForTenantRole('CRM_ADMIN')).toBeNull();
  });

  it('never escalates: no membership role maps above its DB equivalent', () => {
    // Guards the specific regression: before this mapping existed, a user who
    // was crm_admin in their home org kept crm_admin after switching into a
    // tenant where they were only staff or read_only — and the service-role
    // user-admin routes gated on exactly that value.
    expect(crmRoleForTenantRole('staff')).not.toBe('crm_admin');
    expect(crmRoleForTenantRole('read_only')).not.toBe('crm_admin');
    expect(crmRoleForTenantRole('read_only')).not.toBe('crm_agent');
  });
});
