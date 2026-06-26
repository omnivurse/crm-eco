import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser, type MemberPortalContext } from '@crm-eco/lib';

export interface MemberContext extends MemberPortalContext {
  /** Normalized members.status the gate admitted (always one of PORTAL_ACCESS_MEMBER_STATUSES). */
  memberStatus: string;
  /** Latest membership row id, if one exists. Null is normal until activation. */
  activeMembershipId: string | null;
  /** Latest membership row status, if one exists. */
  activeMembershipStatus: string | null;
}

/**
 * Member statuses permitted to use the member portal. This is an ALLOWLIST
 * (fail-closed): any status not listed here — including null, 'inactive', or a
 * future/unknown value — is denied. Audited against live prod data
 * (members.status ∈ {active, inactive}); see memory/portal-live-reality.md.
 * Extend deliberately if a new "can access" status is introduced.
 */
export const PORTAL_ACCESS_MEMBER_STATUSES: ReadonlySet<string> = new Set(['active']);

/**
 * Resolves the current member context (profile + members row) and enforces that
 * the member is in a portal-eligible status.
 *
 * Gate (all fail-closed):
 *  - /login              when there is no authenticated user
 *  - /access-denied?reason=no_member        when no member can be resolved
 *  - /access-denied?reason=inactive_member  when members.status is not in the allowlist
 *
 * NOTE: a `memberships` row is treated as best-effort metadata, NOT a gate.
 * The memberships table is populated on activation; requiring it would lock out
 * every active member before activation runs. Eligibility is therefore driven by
 * members.status (the populated source of truth), and the latest membership row
 * (if any) is surfaced as metadata for callers that want it.
 *
 * Cached per request via React's `cache()`.
 */
export const requireActiveMembership = cache(async (): Promise<MemberContext> => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const ctx = await getMemberForUser(supabase, user.id);
  if (!ctx) redirect('/access-denied?reason=no_member');

  // Fail-closed status gate. Normalize defensively before the allowlist check.
  const memberStatus = (ctx.member.status ?? '').toLowerCase().trim();
  if (!PORTAL_ACCESS_MEMBER_STATUSES.has(memberStatus)) {
    redirect('/access-denied?reason=inactive_member');
  }

  // Best-effort metadata only — its absence must never deny an active member.
  const { data: membership } = await supabase
    .from('memberships')
    .select('id, status')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    profile: ctx.profile,
    member: ctx.member,
    memberStatus,
    activeMembershipId: membership?.id ?? null,
    activeMembershipStatus: membership?.status ?? null,
  };
});
