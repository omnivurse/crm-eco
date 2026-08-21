import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import { PricingSearch } from '@/components/pricing/PricingSearch';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';
import { Info } from '@phosphor-icons/react/dist/ssr';

export default async function PricingPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const context = await getMemberForUser(supabase, user.id);
  if (!context) redirect('/enroll');

  const { member } = context;

  // Pre-fetch procedure list for the dropdown (backup search)
  // Table not yet in generated types — cast to bypass until types are regenerated
  const { data: procedures } = await (supabase as any)
    .from('medical_procedures')
    .select('id, procedure_code, procedure_name, category, avg_national_price')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare cash prices"
        description="Search published hospital cash prices by metro. Start with a CPT or HCPCS code when you have one. Markets on this key are listed in the search form."
        kicker="Pricing"
        backHref="/services"
        backLabel="Back to Services"
      />

      <Bezel>
        <div className="flex items-start gap-3 p-5 md:p-6">
          <Info weight="light" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mp-teal)]" aria-hidden />
          <p className="text-sm leading-relaxed text-slate-600">
            Sharing eligibility still follows your plan and IUA. After you pay, keep the itemized
            bill — you can attach it when you{' '}
            <Link
              href="/needs/new"
              className="font-medium text-[var(--mp-teal)] underline-offset-2 hover:underline"
            >
              submit a sharing need
            </Link>
            .
          </p>
        </div>
      </Bezel>

      <PricingSearch
        memberZip={(member as { zip?: string | null }).zip || ''}
        memberState={(member as { state?: string | null }).state || ''}
        procedures={procedures || []}
      />
    </div>
  );
}
