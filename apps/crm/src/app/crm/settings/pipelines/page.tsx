import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { PipelineSettingsClient } from './PipelineSettingsClient';
import type { PipelineWithStages } from './types';

export const dynamic = 'force-dynamic';

async function PipelinesContent() {
  const profile = await getAuthProfile();
  if (!profile) redirect('/crm-login');
  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    redirect('/crm/settings?error=admin_only');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('crm_pipelines')
    .select('*, crm_pipeline_stages(*)')
    .eq('organization_id', profile.organization_id)
    .order('display_order');

  if (error) {
    console.error('[PipelinesSettings] Load error:', error);
  }

  const pipelines: PipelineWithStages[] = (data || []).map((p: PipelineWithStages) => ({
    ...p,
    crm_pipeline_stages: (p.crm_pipeline_stages || [])
      .filter((s) => s.is_active)
      .sort((a, b) => a.display_order - b.display_order),
  }));

  return (
    <PipelineSettingsClient
      initialPipelines={pipelines}
      canDelete={profile.crm_role === 'crm_admin'}
    />
  );
}

export default function PipelinesSettingsPage() {
  return (
    <Suspense fallback={<PipelinesSkeleton />}>
      <PipelinesContent />
    </Suspense>
  );
}

function PipelinesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        <span className="ml-2 text-slate-500">Loading pipelines...</span>
      </div>
    </div>
  );
}
