'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, X } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useEditRecordData } from '@/hooks/useEditRecordData';
import { queryKeys } from '@/lib/query-keys';
import { mergeCrmRecordRowIntoFormDefaults } from '@/lib/crm/record-form-defaults';
import {
  DynamicRecordForm,
  type DynamicRecordFormHandle,
} from '@/components/crm/records/DynamicRecordForm';

interface DiagnoseResponse {
  recordId: string;
  profile: { organization_id: string; crm_role: string | null; user_id: string };
  record: {
    existsAnywhere: boolean;
    visibleViaRls: boolean;
    org_id: string | null;
    module_id: string | null;
    title: string | null;
    updated_at: string | null;
  };
  module: {
    org_id: string | null;
    key: string | null;
    fieldsCount?: number;
    fieldsCountRls?: number;
    layoutsCount?: number;
    layoutsCountRls?: number;
    defaultLayoutsCount?: number;
  };
  serviceRole?: { ok: boolean; error: string | null };
  mergeTombstone: { keeperId: string; mergedAt: string | null } | null;
  flags: { recordOrgMatchesProfile: boolean; moduleOrgMatchesRecord: boolean };
  likelyCause: string;
  rlsError: string | null;
  adminError: string | null;
}

function describeCause(cause: string): string {
  switch (cause) {
    case 'no_such_record':
      return 'No record exists with this id anywhere in the database. The link is stale.';
    case 'merged_with_tombstone':
      return 'This record was merged into another. The keeper id is shown below.';
    case 'wrong_org_for_user':
      return "The record exists but its org_id does not match your profile's organization. RLS is hiding it.";
    case 'module_org_drift':
      return 'The record points at a module owned by another organization, breaking the embed under RLS.';
    case 'rls_hidden_other_reason':
      return 'Service-role can see the record but RLS hides it for your session — check policies/role.';
    case 'visible_should_load':
      return 'The record is visible to you per RLS — this is likely a transient client-side fetch failure. Try reloading.';
    case 'duplicate_default_layouts':
      return 'There is more than one default layout for this module — maybeSingle() throws on multiple rows. Mark only one is_default = true.';
    case 'fields_rls_hidden':
      return "Fields exist for this module but RLS hides them from your session — typically crm_fields.org_id doesn't match your profile org.";
    case 'layouts_rls_hidden':
      return "Layouts exist for this module but RLS hides them from your session — typically crm_layouts.org_id doesn't match your profile org.";
    case 'no_fields_for_module':
      return 'No crm_fields rows exist for this module at all — the module has no field schema configured in this org.';
    case 'service_role_broken':
      return 'SUPABASE_SERVICE_ROLE_KEY on the server is missing or not actually a service_role token — the diagnose admin probe failed. Fix the Vercel env, then re-run.';
    default:
      return cause;
  }
}

function RecordNotFoundDiagnostic({ recordId }: { recordId: string }) {
  const [diag, setDiag] = useState<DiagnoseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/crm/records/${recordId}/diagnose`);
        if (!res.ok) {
          setError(`Diagnose returned ${res.status}`);
          return;
        }
        const body = (await res.json()) as DiagnoseResponse;
        if (!cancelled) setDiag(body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto px-4 text-center">
      <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Record not found
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1 font-mono break-all">
        record id: {recordId}
      </p>
      {loading && (
        <p className="text-xs text-slate-500 mb-4">Running diagnostics…</p>
      )}
      {error && !loading && (
        <p className="text-xs text-red-500 mb-4">Diagnostics failed: {error}</p>
      )}
      {diag && !loading && (
        <div className="text-left text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg p-4 mb-4 w-full font-mono break-all">
          <p className="mb-2 text-slate-700 dark:text-slate-300">
            <span className="font-semibold">cause:</span> {diag.likelyCause}
          </p>
          <p className="mb-3 text-slate-600 dark:text-slate-400 normal-case font-sans">
            {describeCause(diag.likelyCause)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p className="text-slate-500">profile.org_id</p>
              <p className="text-slate-800 dark:text-slate-200">
                {diag.profile.organization_id}
              </p>
            </div>
            <div>
              <p className="text-slate-500">profile.crm_role</p>
              <p className="text-slate-800 dark:text-slate-200">
                {diag.profile.crm_role ?? 'null'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">record.exists</p>
              <p className="text-slate-800 dark:text-slate-200">
                {String(diag.record.existsAnywhere)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">record.visibleViaRls</p>
              <p className="text-slate-800 dark:text-slate-200">
                {String(diag.record.visibleViaRls)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">record.org_id</p>
              <p className="text-slate-800 dark:text-slate-200">
                {diag.record.org_id ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">module.org_id / key</p>
              <p className="text-slate-800 dark:text-slate-200">
                {diag.module.org_id ?? '—'} / {diag.module.key ?? '—'}
              </p>
            </div>
          </div>
          {diag.mergeTombstone && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
              <p className="text-slate-500">merged into keeper</p>
              <Link
                href={`/crm/r/${diag.mergeTombstone.keeperId}/edit`}
                className="text-teal-600 hover:underline"
              >
                {diag.mergeTombstone.keeperId}
              </Link>
            </div>
          )}
        </div>
      )}
      <Button variant="outline" asChild>
        <Link href="/crm">Back to CRM</Link>
      </Button>
    </div>
  );
}

interface PostgrestErrorShape {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

function describeUnknownError(err: unknown): PostgrestErrorShape {
  if (err instanceof Error) return { message: err.message };
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    return {
      message: typeof e.message === 'string' ? e.message : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
      details: typeof e.details === 'string' ? e.details : undefined,
      hint: typeof e.hint === 'string' ? e.hint : undefined,
    };
  }
  return { message: typeof err === 'string' ? err : undefined };
}

function FormMetadataFailedDiagnostic({
  recordId,
  moduleId,
  error,
}: {
  recordId: string;
  moduleId: string | null;
  error: unknown;
}) {
  const e = describeUnknownError(error);
  const [diag, setDiag] = useState<DiagnoseResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/crm/records/${recordId}/diagnose`);
        if (!res.ok) return;
        const body = (await res.json()) as DiagnoseResponse;
        if (!cancelled) setDiag(body);
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto px-4 text-center">
      <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Could not load form metadata
      </p>
      <p className="text-xs text-slate-500 mb-4 font-mono break-all">
        record {recordId}
        {moduleId ? ` · module ${moduleId}` : ''}
      </p>
      <div className="text-left text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg p-4 mb-4 w-full font-mono break-all">
        <p className="text-slate-500 mb-1">error.message</p>
        <p className="text-slate-800 dark:text-slate-200 mb-2">
          {e.message ?? '(no message)'}
        </p>
        {e.code && (
          <>
            <p className="text-slate-500 mb-1">error.code</p>
            <p className="text-slate-800 dark:text-slate-200 mb-2">{e.code}</p>
          </>
        )}
        {e.details && (
          <>
            <p className="text-slate-500 mb-1">error.details</p>
            <p className="text-slate-800 dark:text-slate-200 mb-2">{e.details}</p>
          </>
        )}
        {e.hint && (
          <>
            <p className="text-slate-500 mb-1">error.hint</p>
            <p className="text-slate-800 dark:text-slate-200 mb-2">{e.hint}</p>
          </>
        )}
        {loading && (
          <p className="text-slate-500 mt-3">Running diagnostics…</p>
        )}
        {diag && !loading && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <p className="text-slate-500 mb-1">cause</p>
            <p className="text-slate-800 dark:text-slate-200 mb-2">
              {diag.likelyCause}
            </p>
            {diag.serviceRole && (
              <>
                <p className="text-slate-500 mb-1">service_role probe</p>
                <p
                  className={
                    diag.serviceRole.ok
                      ? 'text-emerald-600 dark:text-emerald-400 mb-2'
                      : 'text-red-600 dark:text-red-400 mb-2'
                  }
                >
                  {diag.serviceRole.ok ? 'ok' : 'failed'}
                  {diag.serviceRole.error
                    ? ` — ${diag.serviceRole.error}`
                    : ''}
                </p>
              </>
            )}
            {diag.adminError && (
              <>
                <p className="text-slate-500 mb-1">admin error</p>
                <p className="text-red-600 dark:text-red-400 mb-2">
                  {diag.adminError}
                </p>
              </>
            )}
            {diag.rlsError && (
              <>
                <p className="text-slate-500 mb-1">rls error</p>
                <p className="text-red-600 dark:text-red-400 mb-2">
                  {diag.rlsError}
                </p>
              </>
            )}
            {diag.module.fieldsCount !== undefined && (
              <>
                <p className="text-slate-500 mb-1">fields rows visible</p>
                <p className="text-slate-800 dark:text-slate-200 mb-2">
                  {diag.module.fieldsCount} (admin) /{' '}
                  {diag.module.fieldsCountRls ?? '?'} (rls)
                </p>
              </>
            )}
            {diag.module.layoutsCount !== undefined && (
              <>
                <p className="text-slate-500 mb-1">layout rows visible</p>
                <p className="text-slate-800 dark:text-slate-200 mb-2">
                  {diag.module.layoutsCount} (admin) /{' '}
                  {diag.module.layoutsCountRls ?? '?'} (rls) ·{' '}
                  {diag.module.defaultLayoutsCount ?? '?'} default
                </p>
              </>
            )}
          </div>
        )}
      </div>
      <Button variant="outline" asChild>
        <Link href="/crm">Back to CRM</Link>
      </Button>
    </div>
  );
}

const AUTOSAVE_DELAY_MS = 8_000;

export default function EditRecordPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const formRef = useRef<DynamicRecordFormHandle>(null);
  const latestValuesRef = useRef<Record<string, unknown>>({});
  const initialValuesRef = useRef<Record<string, unknown>>({});

  const { data, isLoading, error, recordRow, recordQueryError, moduleMetadataMissing, dependentsFailed } =
    useEditRecordData(recordId);
  const record = data?.record;
  const fields = useMemo(() => data?.fields ?? [], [data?.fields]);
  const layout = data?.layout ?? null;

  // Stale-URL recovery: when the fetch finishes with no record, check the
  // server whether this id was merged into another. If so, forward to the
  // keeper's edit page rather than rendering "Record not found".
  const [resolving, setResolving] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    // Use the raw row — while fields/layout load, aggregated `record` is still undefined.
    if (recordRow) return;
    if (!recordId) return;
    let cancelled = false;
    setResolving(true);
    (async () => {
      try {
        const res = await fetch(`/api/crm/records/${recordId}/resolve`);
        if (!res.ok) return;
        const body = (await res.json()) as {
          kind: 'found' | 'merged' | 'missing';
          keeperId?: string;
          keeperTitle?: string | null;
        };
        if (cancelled) return;
        if (body.kind === 'merged' && body.keeperId && body.keeperId !== recordId) {
          const label = body.keeperTitle ? ` into "${body.keeperTitle}"` : '';
          toast.info(`This record was merged${label}. Opening the current version.`, {
            duration: 4000,
          });
          router.replace(
            `/crm/r/${body.keeperId}/edit?merged_from=${encodeURIComponent(recordId)}`
          );
        }
      } catch {
        // Fall through to not-found UI.
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, recordRow, recordId, router]);

  const defaultValues = useMemo(() => {
    if (!record) return {} as Record<string, unknown>;
    const merged = mergeCrmRecordRowIntoFormDefaults(
      record as unknown as Parameters<typeof mergeCrmRecordRowIntoFormDefaults>[0]
    );
    initialValuesRef.current = merged;
    latestValuesRef.current = merged;
    return merged;
  }, [record]);

  // Only surface a load error after merge recovery has settled; otherwise a
  // transient fetch issue or a merged stale id can wrongly pair "Failed to
  // load" with a redirect to the keeper.
  useEffect(() => {
    if (isLoading || resolving) return;
    if (recordRow) return;
    if (!recordQueryError) return;
    toast.error('Failed to load record');
  }, [isLoading, resolving, recordRow, recordQueryError]);

  // Track form values + dirty state from the shared form component
  const handleValuesChange = useCallback((values: Record<string, unknown>) => {
    latestValuesRef.current = values;
  }, []);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // Warn user before leaving with unsaved changes (browser close/refresh)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // In-app navigation guard: intercept clicks on internal links when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      const confirmed = window.confirm('You have unsaved changes. Leave without saving?');
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isDirty]);

  /**
   * Persist via the shared `PATCH /api/crm/records/[id]` so workflows,
   * scoring, normalization, and PHI logging always run.
   */
  const persist = useCallback(
    async (values: Record<string, unknown>) => {
      const response = await fetch(`/api/crm/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: values }),
      });
      const result = await response.json();
      if (!response.ok || !result?.id) {
        throw new Error(result?.error || 'Failed to save record');
      }
      return result;
    },
    [recordId]
  );

  // Auto-save: debounced save after last change
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isDirty || !record) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await persist(latestValuesRef.current);
        initialValuesRef.current = { ...latestValuesRef.current };
        formRef.current?.reset(latestValuesRef.current);
        setIsDirty(false);
        toast.success('Auto-saved', { duration: 2000 });
      } catch {
        // silent — user will save manually
      }
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isDirty, record, persist]);

  const invalidateCaches = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['edit-record', recordId] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.records.detail(recordId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.records.drawer(recordId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.records.lists() });
  }, [queryClient, recordId]);

  const handleSave = useCallback(async () => {
    if (!record) return;
    setSaving(true);
    try {
      // Pull the latest values straight from the form to avoid stale ref content
      const values = formRef.current?.getValues() ?? latestValuesRef.current;
      await persist(values);
      await invalidateCaches();
      setIsDirty(false);
      toast.success('Record updated successfully');
      router.refresh();
      router.push(`/crm/r/${recordId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save record';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [record, persist, invalidateCaches, recordId, router]);

  const handleSubmitFromForm = useCallback(
    async (values: Record<string, unknown>) => {
      if (!record) return;
      setSaving(true);
      try {
        await persist(values);
        await invalidateCaches();
        setIsDirty(false);
        toast.success('Record updated successfully');
        router.refresh();
        router.push(`/crm/r/${recordId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save record';
        toast.error(msg);
      } finally {
        setSaving(false);
      }
    },
    [record, persist, invalidateCaches, recordId, router]
  );

  if (isLoading || resolving) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  /** Module join empty under RLS (typical: module.org_id ≠ record.org_id after tenant moves). */
  if (moduleMetadataMissing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto px-4 text-center">
        <p className="font-medium text-slate-900 dark:text-white mb-2">Cannot load this record&apos;s module</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          The row exists, but CRM could not resolve its module metadata. This usually means{' '}
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">module_id</code> points
          at another organization&apos;s module after a migration or import — the list may still show the
          title, but edit needs a matching module in your org.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mb-6 font-mono break-all">
          record&nbsp;{recordId}
          {recordRow?.module_id ? ` · module_id ${recordRow.module_id}` : ''}
        </p>
        <Button variant="outline" asChild>
          <Link href="/crm">Back to CRM</Link>
        </Button>
      </div>
    );
  }

  if (dependentsFailed && error != null) {
    return (
      <FormMetadataFailedDiagnostic
        recordId={recordId}
        moduleId={recordRow?.module_id ?? null}
        error={error}
      />
    );
  }

  if (!data?.record) {
    return <RecordNotFoundDiagnostic recordId={recordId} />;
  }

  const editRecord = data.record;

  return (
    <div className="w-full px-3 sm:px-4 py-3">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/crm/r/${recordId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {editRecord.title}
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Edit {editRecord.module.name}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Editing: {editRecord.title}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/crm/r/${recordId}`)}
              className="border-slate-200 dark:border-white/10"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/*
        Render the SAME component used on the record detail view (`DynamicRecordForm`)
        with the SAME default layout and field metadata. The result: identical section
        order, labels, grouping, and field types — view and edit truly mirror each other.
      */}
      <DynamicRecordForm
        ref={formRef}
        fields={fields}
        layout={layout}
        defaultValues={defaultValues}
        record={editRecord}
        mode="edit"
        isLoading={saving}
        onSubmit={handleSubmitFromForm}
        onCancel={() => router.push(`/crm/r/${recordId}`)}
        onDirtyChange={handleDirtyChange}
        onValuesChange={handleValuesChange}
      />

      {/* Footer Actions — sticky so save button is always reachable */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-white/10 z-10 py-3 px-6 -mx-6 mt-6 flex items-center justify-end gap-3">
        {isDirty && (
          <span className="mr-auto text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        )}
        <Button
          variant="outline"
          onClick={() => router.push(`/crm/r/${recordId}`)}
          className="border-slate-200 dark:border-white/10"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-500 hover:bg-teal-600 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
