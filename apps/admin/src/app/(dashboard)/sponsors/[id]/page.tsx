import { notFound } from 'next/navigation';
import { Badge } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { getActiveTenant } from '@/lib/tenant';
import { SponsorDetail } from '@/components/sponsors/SponsorDetail';

export const dynamic = 'force-dynamic';

export default async function SponsorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getActiveTenant();
  if (!tenant) notFound();

  const supabase = (await createServerSupabaseClient()) as any;

  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('*')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .maybeSingle();

  if (!sponsor) notFound();

  const [plansRes, sponsorPlansRes, rosterRes, invoicesRes, adminsRes] = await Promise.all([
    supabase
      .from('plans')
      .select('id, name, code')
      .eq('organization_id', tenant.organizationId)
      .eq('is_active', true)
      .order('name'),
    supabase.from('sponsor_plans').select('id, plan_id, is_default, available_for_enrollment').eq('sponsor_id', id),
    supabase
      .from('sponsor_roster')
      .select('id, first_name, last_name, date_of_birth, email, relationship, status, eligible_end')
      .eq('sponsor_id', id)
      .order('last_name')
      .limit(200),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total, period_start, period_end')
      .eq('sponsor_id', id)
      .eq('payer_type', 'sponsor')
      .order('created_at', { ascending: false })
      .limit(24),
    supabase.from('sponsor_admins').select('id, email, role, user_id, accepted_at').eq('sponsor_id', id).order('email'),
  ]);

  return (
    <div className="space-y-6">
      <EntityPageHeader
        backHref="/sponsors"
        backLabel="Sponsors"
        title={sponsor.name}
        description={sponsor.legal_name || 'Employer sponsor'}
        badges={<Badge variant={sponsor.status === 'active' ? 'default' : 'secondary'}>{sponsor.status}</Badge>}
      />
      <SponsorDetail
        sponsor={sponsor}
        plans={plansRes.data ?? []}
        sponsorPlans={sponsorPlansRes.data ?? []}
        roster={rosterRes.data ?? []}
        invoices={invoicesRes.data ?? []}
        admins={adminsRes.data ?? []}
      />
    </div>
  );
}
