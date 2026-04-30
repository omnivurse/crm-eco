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

  const { data, isLoading, error, recordRow, recordQueryError } = useEditRecordData(recordId);
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

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-slate-600 dark:text-slate-400 mb-4">Record not found</p>
        <Button variant="outline" asChild>
          <Link href="/crm">Back to CRM</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-4 py-3">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/crm/r/${recordId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {record.title}
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Edit {record.module.name}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Editing: {record.title}</p>
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
        record={record}
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
