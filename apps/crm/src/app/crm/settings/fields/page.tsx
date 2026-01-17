import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getCurrentProfile, getAllModules, getFieldsForModule } from '@/lib/crm/queries';
import { FieldsManagerClient } from './FieldsManagerClient';

interface PageProps {
  searchParams: Promise<{
    module?: string;
  }>;
}

async function FieldsContent({ searchParams }: PageProps) {
  const { module: moduleId } = await searchParams;

  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  if (profile.crm_role !== 'crm_admin') {
    redirect('/crm/settings?error=admin_only');
  }

  const modules = await getAllModules(profile.organization_id);
  const selectedModule = moduleId
    ? modules.find(m => m.id === moduleId)
    : modules[0];

  const fields = selectedModule
    ? await getFieldsForModule(selectedModule.id)
    : [];

  // Sort fields by display_order
  const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order);

  return (
    <FieldsManagerClient
      modules={modules}
      selectedModule={selectedModule || null}
      initialFields={sortedFields}
      orgId={profile.organization_id}
    />
  );
}

export default function FieldsPage(props: PageProps) {
  return (
    <Suspense fallback={<FieldsSkeleton />}>
      <FieldsContent {...props} />
    </Suspense>
  );
}

function FieldsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg animate-pulse"
            >
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        <span className="ml-2 text-slate-500">Loading fields...</span>
      </div>
    </div>
  );
}
