import { Suspense } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import { PricingSearch } from '@/components/pricing/PricingSearch';
import { PageHeader } from '@/components/PageHeader';

export default async function PricingPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const context = await getMemberForUser(supabase, user.id);
  if (!context) redirect('/enroll');

  const { member } = context;

  const { data: procedures } = await (supabase as any)
    .from('medical_procedures')
    .select('id, procedure_code, procedure_name, category, avg_national_price')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash prices"
        description="Read published hospital cash for one code in one HCL metro. This page is a slice, not the market."
        kicker="Pricing"
        backHref="/services"
        backLabel="Back to Services"
      />

      <Suspense fallback={<p className="text-sm text-slate-500">Loading the instrument…</p>}>
        <PricingSearch
          memberZip={(member as { zip?: string | null }).zip || ''}
          memberState={(member as { state?: string | null }).state || ''}
          procedures={procedures || []}
        />
      </Suspense>
    </div>
  );
}
