import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { CommissionRateForm } from '@/components/commissions/CommissionRateForm';
import { getActiveTenant } from '@/lib/tenant';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCommissionRatePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) redirect('/access-denied');

  const { data: rate, error } = await (supabase.from('commission_rates') as any)
    .select('*')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single();

  if (error || !rate) notFound();

  return <CommissionRateForm rate={rate} organizationId={tenant.organizationId} />;
}
