import { NextResponse } from 'next/server';
import { getActiveTenant } from './tenant';

export type AdminRole = 'owner' | 'admin' | 'staff';

export const ADMIN_ROLES: AdminRole[] = ['owner', 'admin', 'staff'];

/** Roles within an organization that are considered admin-tier. */
export const ADMIN_TENANT_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
  'staff',
]);

/**
 * Roles permitted to move money or apply irreversible financial state
 * (payout dispatch, price-change execution). Deliberately excludes `staff`
 * and `read_only`. Mirrors FINANCIAL_ROLES in
 * `supabase/functions/_shared/org-auth.ts` — keep the two in sync.
 */
export const FINANCIAL_TENANT_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
]);

export function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

/**
 * Verify the request comes from an authenticated user who is an
 * admin-tier member of the *active tenant*.
 *
 * IMPORTANT: `profile.organization_id` returned here is the active
 * tenant's id (NOT `profiles.organization_id`). This keeps every
 * existing query — `.eq('organization_id', profile.organization_id)`
 * — implicitly tenant-aware once the user switches orgs.
 *
 * Returns the profile or a `NextResponse` error suitable for direct
 * return from a route handler.
 */
export async function requireAdminRole(
  supabase: any,
  allowedRoles: Set<string> = ADMIN_TENANT_ROLES,
): Promise<
  | {
      profile: {
        id: string;
        organization_id: string;
        role: string;
        full_name: string | null;
        user_id: string;
      };
      error: null;
    }
  | { profile: null; error: NextResponse }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      profile: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const tenant = await getActiveTenant();
  if (!tenant) {
    return {
      profile: null,
      error: NextResponse.json(
        { error: 'No active tenant in scope' },
        { status: 403 },
      ),
    };
  }

  if (!allowedRoles.has(tenant.role)) {
    return {
      profile: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return {
      profile: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    profile: {
      ...profile,
      organization_id: tenant.organizationId,
      role: tenant.role,
      user_id: user.id,
    },
    error: null,
  };
}

export function getRoleLabel(role: AdminRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Administrator';
    case 'staff':
      return 'Staff';
    default:
      return role;
  }
}

export function getRoleBadgeVariant(
  role: AdminRole,
): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'owner':
      return 'default';
    case 'admin':
      return 'secondary';
    case 'staff':
      return 'outline';
    default:
      return 'outline';
  }
}
