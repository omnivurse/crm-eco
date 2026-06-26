'use server';

import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

const CAN_INVITE = ['owner', 'super_admin', 'admin'];
const INVITABLE_ROLES = ['owner', 'admin', 'staff', 'advisor'];

/**
 * Invite a staff user to the active organization.
 *
 * Sends a Supabase Auth invite email carrying organization_id + role in user
 * metadata; the handle_new_user trigger turns that into a complete profiles row
 * (role from metadata). Staff-only (owner/admin/super_admin), org-scoped.
 * (Previously this was a client-side stub that only showed a "would be sent" toast.)
 */
export async function inviteStaffUser(
  email: string,
  role: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Unauthorized' };

    const tenant = await getActiveTenant();
    if (!tenant) return { ok: false, error: 'No active organization' };
    if (!CAN_INVITE.includes(tenant.role)) {
      return { ok: false, error: 'You do not have permission to invite users.' };
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { ok: false, error: 'A valid email address is required.' };
    }
    const inviteRole = INVITABLE_ROLES.includes(role) ? role : 'staff';

    const service = createServiceRoleClient();
    const { error } = await service.auth.admin.inviteUserByEmail(cleanEmail, {
      data: { organization_id: tenant.organizationId, role: inviteRole, full_name: '' },
    });
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch {
    return { ok: false, error: 'An unexpected error occurred.' };
  }
}
