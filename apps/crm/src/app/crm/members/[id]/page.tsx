import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCachedCurrentProfile } from '@/lib/crm/queries';

export const dynamic = 'force-dynamic';

/**
 * Deep-link bridge: `/crm/members/:mmsMemberId` → CRM record detail.
 * Ticket board/detail links use MMS member ids; the canonical UI is `/crm/r/:recordId`
 * when a linked CRM record exists.
 */
export default async function CrmMemberBridgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: memberId } = await params;
  const profile = await getCachedCurrentProfile();
  if (!profile?.organization_id) redirect('/crm-login');

  const supabase = await createServerSupabaseClient();

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!member) notFound();

  // Prefer records that store linked_member_id in data JSONB.
  const { data: linked } = await supabase
    .from('crm_records')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .contains('data', { linked_member_id: memberId })
    .is('deleted_at' as never, null)
    .limit(1)
    .maybeSingle();

  if (linked?.id) {
    redirect(`/crm/r/${linked.id}`);
  }

  // Fallback: email match used by MembersListClient.
  const { data: memberRow } = await supabase
    .from('members')
    .select('email')
    .eq('id', memberId)
    .maybeSingle();

  if (memberRow?.email) {
    const { data: byEmail } = await supabase
      .from('crm_records')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .ilike('email', memberRow.email)
      .is('deleted_at' as never, null)
      .limit(1)
      .maybeSingle();

    if (byEmail?.id) {
      redirect(`/crm/r/${byEmail.id}`);
    }
  }

  // No CRM record yet — keep the members list as a safe landing.
  redirect('/crm/members');
}
