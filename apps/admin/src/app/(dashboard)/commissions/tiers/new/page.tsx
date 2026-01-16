import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CommissionTierForm } from '@/components/commissions/CommissionTierForm';

async function getOrganizationId() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  return profile?.organization_id ?? null;
}

export default async function NewCommissionTierPage() {
  const organizationId = await getOrganizationId();

  if (!organizationId) {
    redirect('/access-denied');
  }

  return <CommissionTierForm organizationId={organizationId} />;
}
