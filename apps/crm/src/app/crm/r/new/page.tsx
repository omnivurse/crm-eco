import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getCurrentProfile,
  getModules,
  getModuleByKey,
  getFieldsForModule,
  getDefaultLayout,
} from '@/lib/crm/queries';
import { createRecord, type CreateRecordInput } from '@/lib/crm/mutations';
import { RecordDraftAutosave } from '@/components/crm/records/RecordDraftAutosave';
import { UnsavedFormGuard } from '@/components/crm/records/UnsavedFormGuard';
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
// Record Creation Form View (module selected)
// ============================================================================

async function RecordFormView({
  moduleKey,
  orgId,
  profileId,
}: {
  moduleKey: string;
  orgId: string;
  profileId: string;
}) {
  let crmModule;
  try {
    crmModule = await getModuleByKey(orgId, moduleKey);
  } catch (err) {
    console.error('[NewRecord] Failed to get module:', err);
    return notFound();
  }
  if (!crmModule) return notFound();

  const [fieldsResult, layoutResult] = await Promise.allSettled([
    getFieldsForModule(crmModule.id),
    getDefaultLayout(crmModule.id),
  ]);

  const fields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
  const layout = layoutResult.status === 'fulfilled' ? layoutResult.value : null;

  async function handleSubmit(formData: FormData) {
    'use server';

    const profile = await getCurrentProfile();
    if (!profile) redirect(`/crm-login?error=session_expired&return=/crm/r/new?module=${moduleKey}`);

    const crmMod = await getModuleByKey(profile.organization_id, moduleKey);
    if (!crmMod) throw new Error('Module not found');

    const data: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (key !== '_action' && value !== '') {
        data[key] = value;
      }
    });

    const input: CreateRecordInput = {
      org_id: profile.organization_id,
      module_id: crmMod.id,
      owner_id: profile.id,
      data,
    };

    const record = await createRecord(input);
    redirect(`/crm/r/${record.id}`);
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm/r/new"
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            New {crmModule.name}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Fill in the details to create a new {crmModule.name.toLowerCase()} record
          </p>
        </div>
      </div>

      {/* Form */}
      <UnsavedFormGuard>
        <form action={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
            <RecordDraftAutosave
              moduleKey={moduleKey}
              fields={fields}
              layout={layout}
              storageScope={orgId}
            />
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 z-10 py-4 flex items-center justify-end gap-3 -mx-6 px-6">
            <Link
              href="/crm/r/new"
              className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors shadow-sm"
            >
              Create {crmModule.name}
            </button>
          </div>
        </form>
      </UnsavedFormGuard>
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

  // If a module is selected via query param, show the form
  if (moduleKey) {
    return (
      <RecordFormView
        moduleKey={moduleKey}
        orgId={profile.organization_id}
        profileId={profile.id}
      />
    );
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
