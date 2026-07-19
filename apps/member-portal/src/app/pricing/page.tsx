import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import { PricingSearch } from '@/components/pricing/PricingSearch';
import { PageHeader } from '@/components/PageHeader';

export default async function PricingPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const context = await getMemberForUser(supabase, user.id);
  if (!context) redirect('/enroll');

  const { member } = context;

  // Pre-fetch procedure list for the dropdown
  // Table not yet in generated types — cast to bypass until types are regenerated
  const { data: procedures } = await (supabase as any)
    .from('medical_procedures')
    .select('id, procedure_code, procedure_name, category, avg_national_price')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare Cash Prices"
        description="Find and compare cash prices for common medical procedures near you."
        kicker="Pricing"
      />
      <PricingSearch
        memberZip={(member as any).zip || ''}
        procedures={procedures || []}
      />
    </div>
  );
}
