import { Suspense } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CarrierManagement } from '@/components/carriers/CarrierManagement';
import { getActiveTenant } from '@/lib/tenant';

async function getCarriers() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenant();
  if (!profile) redirect('/login');

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Carriers</h1>
        <p className="text-sm text-slate-500 mt-1">Manage insurance carriers and HealthShare programs</p>
      </div>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading...</div>}>
        <CarrierManagement initialCarriers={carriers} orgId={orgId} />
      </Suspense>
    </div>
  );
}
