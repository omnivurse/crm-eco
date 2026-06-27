import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';
import { getMemberPortalStatus } from '../actions';
import {
  loadMemberCommandCenterData,
  type MemberCommandTab,
} from '@/lib/member-command/queries';
import { MemberCommandCenter } from '@/components/members/command-center/MemberCommandCenter';

async function getStaffContext() {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', tenant.organizationId)
    .maybeSingle();

  if (!profile?.id) return null;

  return { organizationId: tenant.organizationId, profileId: profile.id };
}

const VALID_TABS = new Set<string>([
  'overview',
  'profile',
  'household',
  'dependents',
  'enrollments',
  'coverage',
  'products',
  'billing',
  'invoices',
  'payment-profiles',
  'portal',
  'documents',
  'activity',
  'audit',
  'communication',
  'tasks',
  'notes',
  'settings',
]);

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab = tab && VALID_TABS.has(tab) ? (tab as MemberCommandTab) : 'overview';

  const [data, portal, staff] = await Promise.all([
    loadMemberCommandCenterData(id),
    getMemberPortalStatus(id),
    getStaffContext(),
  ]);

  if (!data || !staff) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading member command center…</div>}>
      <MemberCommandCenter
        data={data}
        portal={portal}
        organizationId={staff.organizationId}
        profileId={staff.profileId}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
