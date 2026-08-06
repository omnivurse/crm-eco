export interface OrgAuthProfile {
  organization_id: string;
  role: string | null;
  is_active: boolean | null;
}

export interface OrgAuthMembership {
  role: string | null;
  is_active: boolean | null;
}

export type ProfileAccessDecision = 'allow' | 'deny' | 'check_membership';

function roleIsAllowed(role: string | null, requiredRoles?: string[]): boolean {
  return !requiredRoles || (typeof role === 'string' && requiredRoles.includes(role));
}

/**
 * Decide whether a profile grants access directly or requires a tenant-membership check.
 * Explicitly deactivated profiles always fail closed, even if a stale membership remains active.
 */
export function decideProfileAccess(
  profile: OrgAuthProfile | null | undefined,
  organizationId: string,
  requiredRoles?: string[],
): ProfileAccessDecision {
  if (!profile || profile.is_active === false) return 'deny';

  if (
    profile.organization_id === organizationId &&
    roleIsAllowed(profile.role, requiredRoles)
  ) {
    return 'allow';
  }

  return 'check_membership';
}

/** Require an explicitly active membership and, when supplied, an allowed tenant role. */
export function membershipAllowsAccess(
  membership: OrgAuthMembership | null | undefined,
  requiredRoles?: string[],
): boolean {
  return membership?.is_active === true && roleIsAllowed(membership.role, requiredRoles);
}
