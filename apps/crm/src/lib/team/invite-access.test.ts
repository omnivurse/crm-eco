import { describe, expect, it } from 'vitest';
import {
  canAccessTeamSettings,
  canInviteOrgAdmin,
  canManageTeamMembers,
  canSendTeamInvite,
  crmRoleForInvitedOrgRole,
  effectiveOrgRole,
  normalizeInvitableOrgRole,
} from './invite-access';

describe('team invite access', () => {
  it('lets a CRM admin manage the team page and send invites', () => {
    const crmAdmin = { crm_role: 'crm_admin', role: 'staff' };
    expect(canAccessTeamSettings(crmAdmin)).toBe(true);
    expect(canSendTeamInvite(crmAdmin)).toBe(true);
    expect(canInviteOrgAdmin(crmAdmin)).toBe(true);
    expect(canManageTeamMembers(crmAdmin)).toBe(true);
  });

  it('lets an organization owner invite even without a CRM role column', () => {
    const owner = { crm_role: null, role: 'owner' };
    expect(canSendTeamInvite(owner)).toBe(true);
    expect(canInviteOrgAdmin(owner)).toBe(true);
  });

  it('does not treat a CRM agent as a team admin', () => {
    const agent = { crm_role: 'crm_agent', role: 'advisor' };
    expect(canAccessTeamSettings(agent)).toBe(false);
    expect(canSendTeamInvite(agent)).toBe(false);
    expect(canInviteOrgAdmin(agent)).toBe(false);
  });

  it('maps sales invite label to advisor org role', () => {
    expect(normalizeInvitableOrgRole('sales')).toBe('advisor');
    expect(normalizeInvitableOrgRole('admin')).toBe('admin');
  });

  it('grants CRM access for every persisted invite role', () => {
    expect(crmRoleForInvitedOrgRole('admin')).toBe('crm_admin');
    expect(crmRoleForInvitedOrgRole('advisor')).toBe('crm_agent');
    expect(crmRoleForInvitedOrgRole('staff')).toBe('crm_agent');
  });

  it('fails closed for roles that cannot be persisted by the invite API', () => {
    expect(crmRoleForInvitedOrgRole('super_admin')).toBeNull();
    expect(crmRoleForInvitedOrgRole('owner')).toBeNull();
    expect(crmRoleForInvitedOrgRole('unknown')).toBeNull();
  });

  it('elevates crm_admin to admin for org-role hierarchy', () => {
    expect(effectiveOrgRole({ crm_role: 'crm_admin', role: 'staff' })).toBe('admin');
    expect(effectiveOrgRole({ crm_role: null, role: 'owner' })).toBe('owner');
  });
});
