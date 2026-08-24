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
  if (profile.crm_role === 'crm_admin') return true;
  return ['owner', 'super_admin'].includes(profile.role || '');
}

export function canAccessTeamSettings(profile: {
  role?: string | null;
  crm_role?: string | null;
}): boolean {
  return canSendTeamInvite(profile);
}
