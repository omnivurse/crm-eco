import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getCurrentProfile,
  getModuleByKey,
  getFieldsForModule,
  getDefaultView,
} from '@/lib/crm/queries';
import { createView } from '@/lib/crm/mutations';

interface PageProps {
  params: Promise<{ moduleKey: string }>;
  searchParams: Promise<{ name?: string }>;
}

async function NewViewContent({ params, searchParams }: PageProps) {
  const { moduleKey } = await params;
  const { name: prefillName } = await searchParams;

  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  // Saving a view writes to the org's shared/personal view set — viewers can't
  // create views. Mirror the create-record permission gate.
  if (!profile.crm_role || profile.crm_role === 'crm_viewer') {
    redirect(`/crm/modules/${moduleKey}?error=no_create_permission`);
  }

  const crmModule = await getModuleByKey(profile.organization_id, moduleKey);
  if (!crmModule) return notFound();

  const [fields, defaultView] = await Promise.all([
    getFieldsForModule(crmModule.id),
    getDefaultView(crmModule.id),
  ]);

  // Pre-check the columns the org already shows by default; otherwise fall back
  // to every field (matching ModuleShell's `fields.map(f => f.key)` default).
  const defaultColumns = defaultView?.columns?.length
    ? defaultView.columns
    : fields.map((f) => f.key);
  const defaultColumnSet = new Set(defaultColumns);

  async function handleSubmit(formData: FormData) {
    'use server';

    const profile = await getCurrentProfile();
    if (!profile) {
      redirect(`/crm-login?error=session_expired&return=/crm/modules/${moduleKey}/views/new`);
    }
    if (!profile.crm_role || profile.crm_role === 'crm_viewer') {
      redirect(`/crm/modules/${moduleKey}?error=no_create_permission`);
    }

    const crmMod = await getModuleByKey(profile.organization_id, moduleKey);
    if (!crmMod) throw new Error('Module not found');

    const name = String(formData.get('name') || '').trim();
    if (!name) {
      redirect(`/crm/modules/${moduleKey}/views/new?error=name_required`);
    }

    // Validate selected columns against this module's real field keys so a
    // tampered form can't persist unknown columns.
    const validKeys = new Set((await getFieldsForModule(crmMod.id)).map((f) => f.key));
    const columns = formData
      .getAll('columns')
      .map((c) => String(c))
      .filter((c) => validKeys.has(c));

    if (columns.length === 0) {
      redirect(`/crm/modules/${moduleKey}/views/new?error=columns_required`);
    }

    const isShared = formData.get('is_shared') === 'on';

    const view = await createView({
      org_id: profile.organization_id,
      module_id: crmMod.id,
      name,
      columns,
      filters: [],
      sort: [],
      is_shared: isShared,
    });

    revalidatePath(`/crm/modules/${moduleKey}`);
    redirect(`/crm/modules/${moduleKey}?view=${view.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/crm/modules/${moduleKey}`}
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            New {crmModule.name} View
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Save a reusable list view with the columns you want to see.
          </p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-6">
        {/* View name */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-2">
          <label
            htmlFor="view-name"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            View name <span className="text-rose-500">*</span>
          </label>
          <input
            id="view-name"
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={prefillName ?? ''}
            autoFocus
            placeholder={`e.g. My ${crmModule.name_plural || crmModule.name}`}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Columns */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Columns
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Choose which columns appear in this view. At least one is required.
            </p>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This module has no fields yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fields.map((field) => (
                <label
                  key={field.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={field.key}
                    defaultChecked={defaultColumnSet.has(field.key)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                    {field.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Sharing */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_shared"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Share with my team
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Shared views are visible to everyone in your organization.
                Uncheck to keep this view private to you.
              </span>
            </span>
          </label>
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
            Save View
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewViewPage(props: PageProps) {
  return (
    <Suspense fallback={<NewViewSkeleton />}>
      <NewViewContent {...props} />
    </Suspense>
  );
}

function NewViewSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="h-28 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
      <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
    </div>
  );
}
