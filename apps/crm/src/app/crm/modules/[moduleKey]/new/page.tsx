import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getCurrentProfile,
  getModuleByKey,
  getFieldsForModule,
  getDefaultLayout,
} from '@/lib/crm/queries';
import { createRecord, type CreateRecordInput } from '@/lib/crm/mutations';
import { RecordDraftAutosave } from '@/components/crm/records/RecordDraftAutosave';
import { UnsavedFormGuard } from '@/components/crm/records/UnsavedFormGuard';

interface PageProps {
  params: Promise<{ moduleKey: string }>;
}

async function NewRecordContent({ params }: PageProps) {
  const { moduleKey } = await params;

  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  // Check permission
  if (!profile.crm_role || profile.crm_role === 'crm_viewer') {
    redirect(`/crm/modules/${moduleKey}?error=no_create_permission`);
  }

  const crmModule = await getModuleByKey(profile.organization_id, moduleKey);
  if (!crmModule) return notFound();

  const [fields, layout] = await Promise.all([
    getFieldsForModule(crmModule.id),
    getDefaultLayout(crmModule.id),
  ]);

  async function handleSubmit(formData: FormData) {
    'use server';

    const profile = await getCurrentProfile();
    if (!profile) redirect(`/crm-login?error=session_expired&return=/crm/modules/${moduleKey}/new`);

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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/crm/modules/${moduleKey}`}
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New {crmModule.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Create a new {crmModule.name.toLowerCase()} record
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
              storageScope={profile.organization_id}
            />
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 z-10 py-4 flex items-center justify-end gap-3 -mx-6 px-6">
            <Link
              href={`/crm/modules/${moduleKey}`}
              className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors shadow-sm"
            >
              Create Record
            </button>
          </div>
        </form>
      </UnsavedFormGuard>
    </div>
  );
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
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-60 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
    </div>
  );
}
