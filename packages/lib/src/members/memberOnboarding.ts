/**
 * Member login onboarding.
 *
 * Creates the portal login for an existing member and links it to their member
 * record. A single Auth admin call carries organization_id / role / member_id /
 * full_name in user metadata; the `handle_new_user` trigger turns that metadata
 * into a complete `profiles` row (role='member', member_id set), which is what the
 * member-facing RLS (private.get_user_member_id()) keys off.
 *
 * SECURITY: the caller MUST pass a SERVICE-ROLE client (Auth admin API), and this
 * is an admin/privileged operation — verify the operator is staff before calling.
 * We additionally verify the member exists in the given org and isn't already
 * linked to a login, so a login can never be attached to the wrong/cross-org
 * member or duplicated.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface OnboardMemberInput {
  memberId: string;
  organizationId: string;
  email: string;
  fullName?: string;
  /**
   * 'invite' (default) emails the member a set-password link (production).
   * 'create' sets a password immediately and confirms the email (admin/testing).
   */
  mode?: 'invite' | 'create';
  /** Required when mode='create'. */
  password?: string;
  /** Where the invite email link returns to (mode='invite'). */
  redirectTo?: string;
}

export interface OnboardMemberResult {
  ok: boolean;
  userId?: string;
  error?: string;
  code?: 'MEMBER_NOT_FOUND' | 'ALREADY_LINKED' | 'AUTH_ERROR' | 'BAD_INPUT';
}

export async function onboardMemberLogin(
  service: SupabaseClient,
  input: OnboardMemberInput,
): Promise<OnboardMemberResult> {
  const { memberId, organizationId, email, fullName, mode = 'invite', password, redirectTo } = input;

  if (!memberId || !organizationId || !email) {
    return { ok: false, error: 'memberId, organizationId and email are required', code: 'BAD_INPUT' };
  }
  if (mode === 'create' && !password) {
    return { ok: false, error: "password is required when mode='create'", code: 'BAD_INPUT' };
  }

  // Verify the member exists in this org (fail-closed; no cross-org linking).
  const { data: member, error: memberErr } = await service
    .from('members')
    .select('id, email, first_name, last_name')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (memberErr) return { ok: false, error: memberErr.message, code: 'AUTH_ERROR' };
  if (!member) return { ok: false, error: 'Member not found in this organization', code: 'MEMBER_NOT_FOUND' };

  // Refuse to create a second login for an already-linked member.
  const { data: existing } = await service
    .from('profiles')
    .select('id')
    .eq('member_id', memberId)
    .maybeSingle();
  if (existing) return { ok: false, error: 'This member already has a login', code: 'ALREADY_LINKED' };

  const metadata = {
    organization_id: organizationId,
    role: 'member',
    member_id: memberId,
    full_name:
      fullName ?? (`${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'Member'),
  };

  if (mode === 'create') {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) return { ok: false, error: error.message, code: 'AUTH_ERROR' };
    return { ok: true, userId: data.user.id };
  }

  // mode === 'invite'
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: metadata,
    ...(redirectTo ? { redirectTo } : {}),
  });
  if (error) return { ok: false, error: error.message, code: 'AUTH_ERROR' };
  return { ok: true, userId: data.user.id };
}
