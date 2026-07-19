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
      <ServicesSearch memberZip={(member as any).zip || ''} />
    </div>
  );
}
