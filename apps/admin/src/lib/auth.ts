import { NextResponse } from 'next/server';

export type AdminRole = 'owner' | 'admin' | 'staff';

export const ADMIN_ROLES: AdminRole[] = ['owner', 'admin', 'staff'];

export function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

/**
 * Verifies the request is from an authenticated user with an admin role
 * (owner, admin, or staff). Returns the profile or an error response.
 */
export async function requireAdminRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<
  | { profile: { id: string; organization_id: string; role: string; full_name: string | null; user_id: string }; error: null }
  | { profile: null; error: NextResponse }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { profile: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, role, full_name')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return { profile: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (!profile.role || !ADMIN_ROLES.includes(profile.role)) {
    return { profile: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { profile: { ...profile, user_id: user.id }, error: null };
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

export function getRoleBadgeVariant(role: AdminRole): 'default' | 'secondary' | 'outline' {
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
