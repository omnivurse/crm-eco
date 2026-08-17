import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentProfile, getModules } from '@/lib/crm/queries';
import { ModuleSelector } from './client';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  searchParams: Promise<{ module?: string }>;
}

// ============================================================================
// Module Selection View (no module chosen yet)
// ============================================================================

async function ModuleSelectionView({ modules }: { modules: { key: string; name: string; icon: string }[] }) {
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm"
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create New Record</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Choose a record type to get started
          </p>
        </div>
      </div>

      {/* Module Grid */}
      <ModuleSelector modules={modules} />
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

async function NewRecordContent({ searchParams }: PageProps) {
  const { module: moduleKey } = await searchParams;

  let profile;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error('[NewRecord] Failed to get profile:', err);
    return notFound();
  }
  if (!profile) return notFound();

  // Check create permission
  if (!profile.crm_role || profile.crm_role === 'crm_viewer') {
    redirect('/crm?error=no_create_permission');
  }

  // A chosen module goes to the single canonical create page (inline
  // duplicate/validation handling, draft autosave, disabled-module guard) —
  // this route no longer keeps a second copy of the form.
  if (moduleKey) {
    redirect(`/crm/modules/${encodeURIComponent(moduleKey)}/new`);
  }

  // Otherwise, show module selection
  const modules = await getModules(profile.organization_id);
  const enabledModules = modules
    .filter((m) => m.is_enabled)
    .map((m) => ({ key: m.key, name: m.name, icon: m.icon }));

  return <ModuleSelectionView modules={enabledModules} />;
}

export default function NewRecordPage(props: PageProps) {
  return (
    <Suspense fallback={<NewRecordSkeleton />}>
      <NewRecordContent {...props} />
    </Suspense>
  );
}

function NewRecordSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
