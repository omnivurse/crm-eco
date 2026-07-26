import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCachedCurrentProfile } from '@/lib/crm/queries';
import { resolveMemberCrmRecordId } from '@/lib/crm/resolve-member-crm-record-query';

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
    .select('id, email, phone, first_name, last_name, member_number')
    .eq('id', memberId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!member) notFound();

  const crmRecordId = await resolveMemberCrmRecordId(
    supabase,
    profile.organization_id,
    member,
  );

  if (crmRecordId) {
    redirect(`/crm/r/${crmRecordId}`);
  }

  // No CRM record yet — keep the members list as a safe landing.
  redirect('/crm/members');
}
