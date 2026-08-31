import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import { ServicesSearch } from '@/components/services/ServicesSearch';
import { PageHeader } from '@/components/PageHeader';

export default async function ServicesPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const context = await getMemberForUser(supabase, user.id);
  if (!context) redirect('/enroll');

  const { member } = context;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find Healthcare Services"
        description="Enter your ZIP code to discover available healthcare services near you."
        kicker="Services"
      />
      <div className="rounded-2xl border border-[rgba(11,109,133,0.12)] bg-white/80 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="font-medium text-[var(--mp-ink)]">Cash prices</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Read published hospital cash for one metro and CPT before you book.
          </p>
        </div>
        <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
          <a
            href="/pricing/book"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[rgba(11,109,133,0.2)] px-4 py-2 text-sm font-medium text-[var(--mp-teal)] hover:bg-white"
          >
            Your tape
          </a>
          <a
            href="/pricing"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--mp-teal)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--mp-teal-soft)]"
          >
            Search rates
          </a>
        </div>
      </div>
      <ServicesSearch
        memberZip={
          (member as { postal_code?: string | null; zip?: string | null }).postal_code ||
          (member as { zip?: string | null }).zip ||
          ''
        }
      />
    </div>
  );
}
