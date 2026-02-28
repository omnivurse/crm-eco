import { Suspense } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { ActuarialExperienceViewLazy } from '@/components/analytics/ActuarialExperienceViewLazy';

async function ActuarialContent() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lg font-semibold text-slate-700">Please sign in to access actuarial data.</p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string; role: string } | null };

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Access Restricted</p>
          <p className="text-sm text-slate-500 mt-1">Only owners and administrators can view actuarial data.</p>
        </div>
      </div>
    );
  }

  const { data, error } = await (supabase as any).rpc('get_actuarial_experience', {
    p_org_id: profile.organization_id,
    p_months: 24,
  });

  if (error) {
    console.error('Actuarial fetch error:', error);
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Unable to load actuarial data</p>
          <p className="text-sm text-slate-500 mt-1">Please try again later.</p>
        </div>
      </div>
    );
  }

  return <ActuarialExperienceViewLazy data={data} />;
}

function ActuarialSkeleton() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      <div className="h-10 w-80 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
      </div>
      <div className="h-80 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function ActuarialPage() {
  return (
    <Suspense fallback={<ActuarialSkeleton />}>
      <ActuarialContent />
    </Suspense>
  );
}
