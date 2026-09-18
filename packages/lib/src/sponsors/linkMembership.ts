import type { SupabaseClient } from '@supabase/supabase-js';

type AnyClient = SupabaseClient;

export function shouldLinkSponsorship(input: {
  enrollmentId?: string | null;
  membershipId?: string | null;
}): boolean {
  return Boolean(input.enrollmentId && input.membershipId);
}

export function shouldHealSponsorshipLink(
  sponsorshipMembershipId?: string | null,
  resolvedMembershipId?: string | null,
): boolean {
  return !sponsorshipMembershipId && Boolean(resolvedMembershipId);
}

/** After finalize / known-roster create: attach the membership to open sponsorships. */
export async function linkSponsorshipToMembership(
  supabase: AnyClient,
  input: {
    organizationId: string;
    enrollmentId: string;
    membershipId: string;
    sponsorId?: string | null;
    memberId?: string | null;
  },
): Promise<{ linked: number; sponsorId: string | null }> {
  const byEnrollment = await supabase
    .from('sponsorships')
    .select('id, sponsor_id, status')
    .eq('organization_id', input.organizationId)
    .eq('enrollment_id', input.enrollmentId)
    .in('status', ['pending', 'active', 'needs_approval']);

  if (byEnrollment.error) throw new Error(byEnrollment.error.message);

  let rows = (byEnrollment.data ?? []).filter(
    (row) => !input.sponsorId || row.sponsor_id === input.sponsorId,
  );

  // A bare member can have multiple sponsorships. Only fall back when the
  // caller supplies the exact sponsor partition to avoid cross-sponsor links.
  if (rows.length === 0 && input.memberId && input.sponsorId) {
    const byMember = await supabase
      .from('sponsorships')
      .select('id, sponsor_id, status')
      .eq('organization_id', input.organizationId)
      .eq('member_id', input.memberId)
      .eq('sponsor_id', input.sponsorId)
      .in('status', ['pending', 'active', 'needs_approval']);
    if (byMember.error) throw new Error(byMember.error.message);
    rows = byMember.data ?? [];
  }

  const sponsorId = input.sponsorId ?? rows[0]?.sponsor_id ?? null;
  let linked = 0;

  for (const row of rows) {
    const nextStatus = row.status === 'needs_approval' ? 'needs_approval' : 'active';
    const { error: updErr } = await supabase
      .from('sponsorships')
      .update({
        membership_id: input.membershipId,
        enrollment_id: input.enrollmentId,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('organization_id', input.organizationId);
    if (updErr) throw new Error(updErr.message);
    linked += 1;
  }

  if (sponsorId) {
    const { error: memErr } = await supabase
      .from('memberships')
      .update({ sponsor_id: sponsorId, updated_at: new Date().toISOString() })
      .eq('id', input.membershipId)
      .eq('organization_id', input.organizationId);
    if (memErr) throw new Error(memErr.message);
  }

  return { linked, sponsorId };
}
