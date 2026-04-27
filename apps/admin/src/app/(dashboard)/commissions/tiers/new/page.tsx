import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CommissionTierForm } from '@/components/commissions/CommissionTierForm';
import { getActiveTenant } from '@/lib/tenant';

async function getOrganizationId() {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  return tenant.organizationId ?? null;
}

export default async function NewCommissionTierPage() {
  const organizationId = await getOrganizationId();

  if (!organizationId) {
    redirect('/access-denied');
  }

  return <CommissionTierForm organizationId={organizationId} />;
}
