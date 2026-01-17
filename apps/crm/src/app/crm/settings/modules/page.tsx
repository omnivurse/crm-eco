import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentProfile, getAllModules } from '@/lib/crm/queries';
import ModulesClient from './modules-client';

async function ModulesContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  if (profile.crm_role !== 'crm_admin') {
    redirect('/crm/settings?error=admin_only');
  }

  const modules = await getAllModules(profile.organization_id);

  return (
    <ModulesClient
      initialModules={modules}
      orgId={profile.organization_id}
    />
  );
}

export default function ModulesPage() {
  return (
    <Suspense fallback={<ModulesSkeleton />}>
      <ModulesContent />
    </Suspense>
  );
}

function ModulesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="space-y-2">
            <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
      <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
    </div>
  );
}
