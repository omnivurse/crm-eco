import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser, type MemberPortalContext } from '@crm-eco/lib';

export interface MemberContext extends MemberPortalContext {
  activeMembershipId: string | null;
  activeMembershipStatus: string | null;
}

/**
 * Resolves the current member context (profile + members row) and asserts
 * the user has at least one membership row (any status).
 *
 * Redirects:
 *  - /login when no auth user
 *  - /access-denied when no member or no membership
 *
 * Cached per request via React's `cache()`.
 */
export const requireActiveMembership = cache(async (): Promise<MemberContext> => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const ctx = await getMemberForUser(supabase, user.id);
  if (!ctx) redirect('/access-denied?reason=no_member');

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, status')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) redirect('/access-denied?reason=no_membership');

  return {
    profile: ctx.profile,
    member: ctx.member,
    activeMembershipId: membership.id,
    activeMembershipStatus: membership.status,
  };
});
