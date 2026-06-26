'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { onboardMemberLogin } from '@crm-eco/lib';
import { getActiveTenant } from '@/lib/tenant';

const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'staff'];

export interface PortalAccessStatus {
  hasLogin: boolean;
  email: string | null;
}

/** Whether a member already has a portal login linked, + their email. */
export async function getMemberPortalStatus(memberId: string): Promise<PortalAccessStatus> {
  const tenant = await getActiveTenant();
  if (!tenant) return { hasLogin: false, email: null };
  const service = createServiceRoleClient();

  const { data: member } = await service
    .from('members')
    .select('email')
    .eq('id', memberId)
    .eq('organization_id', tenant.organizationId)
    .maybeSingle();

  const { data: profile } = await service
    .from('profiles')
    .select('id')
    .eq('member_id', memberId)
    .eq('organization_id', tenant.organizationId)
    .maybeSingle();

  return { hasLogin: !!profile, email: (member?.email as string) ?? null };
}

export interface InviteResult {
  ok: boolean;
  message: string;
}

/**
 * Invite a member to the self-service portal: creates their login (role='member')
 * linked to their member record and emails a set-password link. Staff-only;
 * scoped to the admin's active org. Delegates to @crm-eco/lib onboardMemberLogin,
 * which verifies the member belongs to the org and isn't already linked.
 */
export async function inviteMemberToPortal(memberId: string): Promise<InviteResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'Unauthorized' };

    const tenant = await getActiveTenant();
    if (!tenant) return { ok: false, message: 'No active organization' };
    if (!STAFF_ROLES.includes(tenant.role)) {
      return { ok: false, message: 'You do not have permission to invite members.' };
    }

    const service = createServiceRoleClient();
    const { data: member } = await service
      .from('members')
      .select('id, email')
      .eq('id', memberId)
      .eq('organization_id', tenant.organizationId)
      .maybeSingle();
    if (!member) return { ok: false, message: 'Member not found in your organization.' };
    if (!member.email) return { ok: false, message: 'This member has no email address to invite.' };

    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL;
    const result = await onboardMemberLogin(service, {
      memberId,
      organizationId: tenant.organizationId,
      email: member.email as string,
      mode: 'invite',
      ...(portalUrl ? { redirectTo: `${portalUrl}/signin` } : {}),
    });

    if (!result.ok) {
      if (result.code === 'ALREADY_LINKED') {
        return { ok: false, message: 'This member already has portal access.' };
      }
      return { ok: false, message: result.error ?? 'Failed to send the invite.' };
    }

    revalidatePath(`/members/${memberId}`);
    return { ok: true, message: `Portal invite sent to ${member.email}.` };
  } catch {
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}
