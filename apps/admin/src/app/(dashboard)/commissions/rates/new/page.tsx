import { redirect } from 'next/navigation';
import { CommissionRateForm } from '@/components/commissions/CommissionRateForm';
import { getActiveTenant } from '@/lib/tenant';

export default async function NewCommissionRatePage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect('/access-denied');
  return <CommissionRateForm organizationId={tenant.organizationId} />;
}
