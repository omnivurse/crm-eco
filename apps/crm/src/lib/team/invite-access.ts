/**
 * Who may send / resend organization team invitations.
 *
 * CRM settings uses `crm_role` (`crm_admin`). The invite API historically
 * gated on organization `role` (`owner` / `admin`). Checking only one of
 * those locked CRM admins out of `/crm/settings/team` and related APIs.
 */
export function canSendTeamInvite(profile: {
  role?: string | null;
  crm_role?: string | null;
}): boolean {
  if (profile.crm_role === 'crm_admin') return true;
  return ['owner', 'super_admin', 'admin'].includes(profile.role || '');
}

export function canInviteOrgAdmin(profile: {
  role?: string | null;
  crm_role?: string | null;
}): boolean {
  // CRM administration is scoped to the CRM application. Granting an
  // organization-admin invitation also unlocks billing and organization-wide
  // settings, so only organization owners/super-admins may cross that boundary.
  return ['owner', 'super_admin'].includes(profile.role || '');
}

export function canAccessTeamSettings(profile: {
  role?: string | null;
  crm_role?: string | null;
}): boolean {
  return canSendTeamInvite(profile);
}

/** Same gate as invite — manage org-role for team members. */
export function canManageTeamMembers(profile: {
  role?: string | null;
  crm_role?: string | null;
}): boolean {
  return canSendTeamInvite(profile);
}

type OrgRole = 'owner' | 'super_admin' | 'admin' | 'advisor' | 'staff';

const ORG_ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 5,
  super_admin: 4,
  admin: 3,
  advisor: 2,
  staff: 1,
};

/**
 * Effective org role for hierarchy checks.
 * CRM admins act at least as org `admin` even if profiles.role is lower.
 */
export function effectiveOrgRole(profile: {
  role?: string | null;
  crm_role?: string | null;
}): OrgRole {
  const role = profile.role as OrgRole | null;
  if (role === 'owner') return 'owner';
  if (role === 'super_admin') return 'super_admin';
  if (profile.crm_role === 'crm_admin' || role === 'admin') return 'admin';
  if (role === 'advisor') return 'advisor';
  return 'staff';
}

export function orgRoleLevel(role: string | null | undefined): number {
  if (!role) return 0;
  return ORG_ROLE_HIERARCHY[role as OrgRole] ?? 0;
}

/** Map UI invite labels onto persisted organization roles. */
export function normalizeInvitableOrgRole(
  role: string,
): 'admin' | 'advisor' | 'staff' | 'super_admin' | null {
  if (role === 'sales') return 'advisor';
  if (['admin', 'advisor', 'staff', 'super_admin'].includes(role)) {
    return role as 'admin' | 'advisor' | 'staff' | 'super_admin';
  }
  return null;
}
