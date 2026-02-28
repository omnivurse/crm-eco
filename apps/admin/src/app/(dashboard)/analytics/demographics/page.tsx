import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

const GroupDemographicsView = dynamic(
  () => import('@/components/analytics/GroupDemographicsView').then((m) => m.GroupDemographicsView),
  { ssr: false }
);

async function DemographicsContent() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lg font-semibold text-slate-700">Please sign in to access demographics.</p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lg font-semibold text-slate-700">Profile not found.</p>
      </div>
    );
  }

  const { data, error } = await (supabase as any).rpc('get_group_demographics', {
    p_org_id: profile.organization_id,
  });

  if (error) {
    console.error('Demographics fetch error:', error);
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Unable to load demographics</p>
          <p className="text-sm text-slate-500 mt-1">Please try again later.</p>
        </div>
      </div>
    );
  }

  return <GroupDemographicsView data={data} />;
}

function DemographicsSkeleton() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      <div className="h-10 w-72 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function DemographicsPage() {
  return (
    <Suspense fallback={<DemographicsSkeleton />}>
      <DemographicsContent />
    </Suspense>
  );
}
