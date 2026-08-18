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
          <p className="font-medium text-[var(--mp-ink)]">Compare cash prices</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Search published cash prices for hospital, pharmacy (RX), imaging, and labs before you book.
          </p>
        </div>
        <a
          href="/pricing"
          className="mt-3 inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--mp-teal)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--mp-teal-soft)] sm:mt-0"
        >
          Open price finder
        </a>
      </div>
      <ServicesSearch memberZip={(member as any).zip || ''} />
    </div>
  );
}
