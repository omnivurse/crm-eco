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
import { createRecordResult, type CreateRecordInput } from '@/lib/crm/mutations';
import { disabledModuleRedirect } from '@/lib/crm/nav-profile';
import { buildCrmCreateDataFromFormData } from '@/lib/crm/create-form-data';
import { RecordDraftAutosave } from '@/components/crm/records/RecordDraftAutosave';
import {
  UnsavedFormGuard,
  CREATE_FORM_FORCE_FIELD,
  type CreateFormActionState,
  type CreateFormDuplicate,
} from '@/components/crm/records/UnsavedFormGuard';

interface PageProps {
  params: Promise<{ moduleKey: string }>;
}

async function NewRecordContent({ params }: PageProps) {
  const { moduleKey } = await params;

  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  // Only viewers are turned away here; users admitted via tenant membership
  // (crm_role null) are decided by the service/RLS, whose errors render inline.
  if (profile.crm_role === 'crm_viewer') {
    redirect(`/crm/modules/${moduleKey}?error=no_create_permission`);
  }

  const crmModule = await getModuleByKey(profile.organization_id, moduleKey);
  if (!crmModule) return notFound();
  // Disabled module (e.g. legacy 'deals'): send to the enabled sibling's list
  // instead of offering a create form for a module nobody can see.
  const disabledTarget = disabledModuleRedirect(crmModule);
  if (disabledTarget) redirect(disabledTarget);

  const [fields, layout] = await Promise.all([
    getFieldsForModule(crmModule.id),
    getDefaultLayout(crmModule.id),
  ]);
  const fieldTypes = Object.fromEntries(
    fields.map((field) => [field.key, field.type]),
  );

  /**
   * Server action wired through `useActionState` (see UnsavedFormGuard).
   * NEVER throws for expected outcomes: duplicates / validation / permission
   * problems are RETURNED so the client renders them inline and keeps every
   * typed value + the sessionStorage draft. Success redirects to the record.
   */
  async function handleSubmit(
    _prev: CreateFormActionState,
    formData: FormData,
  ): Promise<CreateFormActionState> {
    'use server';

    const profile = await getCurrentProfile();
    if (!profile) redirect(`/crm-login?error=session_expired&return=/crm/modules/${moduleKey}/new`);
    if (!profile.crm_role || profile.crm_role === 'crm_viewer') {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Your role cannot create records. Ask an admin for access.',
      };
    }

    const crmMod = await getModuleByKey(profile.organization_id, moduleKey);
    if (!crmMod) {
      return { ok: false, code: 'MODULE_NOT_FOUND', message: 'This module no longer exists.' };
    }

    // Whole-form payload is fine for CREATE; blank strings are dropped here
    // (and again defensively in record-create-service) so a new record never
    // carries hundreds of empty keys.
    let force = false;
    formData.forEach((value, key) => {
      if (key === CREATE_FORM_FORCE_FIELD) {
        force = value === '1';
      }
    });
    const data = buildCrmCreateDataFromFormData(formData, fieldTypes);

    const input: CreateRecordInput = {
      org_id: profile.organization_id,
      module_id: crmMod.id,
      owner_id: profile.id,
      data,
      force,
    };

    const result = await createRecordResult(input);
    if (!result.ok) {
      const body = result.body;
      const code = typeof body.code === 'string' ? body.code : undefined;
      const rawDuplicates = Array.isArray(body.duplicates)
        ? (body.duplicates as Array<Record<string, unknown>>)
        : [];
      const duplicates: CreateFormDuplicate[] = rawDuplicates
        .filter((d) => typeof d?.id === 'string')
        .map((d) => ({
          id: d.id as string,
          title: typeof d.title === 'string' ? d.title : null,
          email: typeof d.email === 'string' ? d.email : null,
          phone: typeof d.phone === 'string' ? d.phone : null,
        }));
      const message =
        code === 'DUPLICATE_RECORD'
          ? duplicates.length > 0
            ? 'A record with the same name and email or phone already exists in this module.'
            : 'The database rejected this record as a duplicate (same name + email).'
          : typeof body.error === 'string'
            ? body.error
            : 'Something went wrong while saving. Your entries are preserved — please try again.';
      return {
        ok: false,
        code,
        message,
        duplicates: duplicates.length > 0 ? duplicates : undefined,
      };
    }
    redirect(`/crm/r/${result.record.id}`);
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/crm/modules/${moduleKey}`}
          aria-label={`Back to ${crmModule.name}`}
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New {crmModule.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Create a new {crmModule.name.toLowerCase()} record
          </p>
        </div>
      </div>

      {/* Form — UnsavedFormGuard owns the <form>, inline result banner and the
          sticky Create bar (unsaved pill lives inside the bar, no overlap). */}
      <UnsavedFormGuard
        action={handleSubmit}
        cancelHref={`/crm/modules/${moduleKey}`}
        submitLabel={`Create ${crmModule.name}`}
      >
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <RecordDraftAutosave
            moduleKey={crmModule.key}
            fields={fields}
            layout={layout}
            storageScope={profile.organization_id}
          />
        </div>
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
    <div className="w-full space-y-6 animate-pulse">
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
