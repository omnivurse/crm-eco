import { Suspense } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CarrierManagement } from '@/components/carriers/CarrierManagement';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';

async function getCarriers() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenant();
  if (!tenant) redirect('/login');

  const { data: carriers } = await supabase
    .from('insurance_carriers')
    .select('*')
    .eq('organization_id', tenant.organizationId)
    .order('carrier_name');

  return { carriers: carriers || [], orgId: tenant.organizationId };
}

export default async function CarriersPage() {
  const { carriers, orgId } = await getCarriers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carriers"
        description="Manage insurance carriers and HealthShare programs"
      />
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading...</div>}>
        <CarrierManagement initialCarriers={carriers} orgId={orgId} />
      </Suspense>
    </div>
  );
}
