import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import { ServicesSearch } from '@/components/services/ServicesSearch';

export default async function ServicesPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const context = await getMemberForUser(supabase, user.id);
  if (!context) redirect('/enroll');

  const { member } = context;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Find Healthcare Services</h1>
        <p className="text-slate-500">
          Enter your ZIP code to discover available healthcare services near you.
        </p>
      </div>
      <ServicesSearch memberZip={(member as any).zip || ''} />
    </div>
  );
}
