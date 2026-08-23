import { Suspense } from 'react';
import Link from 'next/link';
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
        actions={
          <Link
            href="/pricing/book"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[rgba(11,109,133,0.2)] px-4 py-2 text-sm font-medium text-[var(--mp-teal)] hover:bg-white"
          >
            Your tape
          </Link>
        }
      />

      <Suspense fallback={<p className="text-sm text-slate-500">Loading the instrument…</p>}>
        <PricingSearch
          memberZip={
            (member as { postal_code?: string | null; zip?: string | null }).postal_code ||
            (member as { zip?: string | null }).zip ||
            ''
          }
          memberState={(member as { state?: string | null }).state || ''}
          procedures={procedures || []}
        />
      </Suspense>
    </div>
  );
}
