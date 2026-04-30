'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import { useTenantOrganizationId } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase-client';
import { queryKeys } from '@/lib/query-keys';
import type { CrmRecord, CrmField, CrmLayout } from '@/lib/crm/types';

/** Full `crm_records` row + module (must match server reads — use `select('*')`). */
export type EditRecordRow = CrmRecord & {
  module: {
    id: string;
    key: string;
    name: string;
    name_plural: string | null;
  };
};

export interface EditRecordData {
  record: EditRecordRow;
  fields: CrmField[];
  /** Same default layout as record detail / `getDefaultLayout` — drives section order & labels */
  layout: CrmLayout | null;
}

/**
 * CRM module id used to load fields/layout. Uses the embedded join first, then falls
 * back to `crm_records.module_id` so dependents still run when PostgREST omits `module`
 * (RLS edge, embed quirk) while the row exists.
 */
function moduleDependencyId(row: EditRecordRow | null | undefined): string | null {
  if (!row) return null;
  if (row.module?.id) return row.module.id;
  if (typeof row.module_id === 'string' && row.module_id.length > 0) return row.module_id;
  return null;
}

/**
 * Load edit row via authenticated API — server heals misaligned `module_id`
 * (RLS hides modules from other orgs) before returning the PostgREST-shaped row.
 */
async function fetchRecordWithModule(recordId: string): Promise<EditRecordRow | null> {
  const res = await fetch(
    `/api/crm/records/${encodeURIComponent(recordId)}/bootstrap-edit`,
    {
      credentials: 'same-origin',
      cache: 'no-store',
    }
  );

  if (res.status === 401) return null;
  if (!res.ok) return null;

  const body = (await res.json()) as { record?: EditRecordRow | null };
  return body.record ?? null;
}

async function fetchFieldsForModule(moduleId: string): Promise<CrmField[]> {
  const { data, error } = await supabase
    .from('crm_fields')
    .select('*')
    .eq('module_id', moduleId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data || []) as CrmField[];
}

async function fetchDefaultLayout(moduleId: string): Promise<CrmLayout | null> {
  // `.limit(1)` over `.maybeSingle()` so accidental duplicate defaults never
  // crash the edit page again (a partial unique index also enforces this at
  // the DB level — see 202605040002_crm_layouts_unique_default.sql).
  const { data, error } = await supabase
    .from('crm_layouts')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_default', true)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return ((data?.[0] ?? null) as CrmLayout | null);
}

export function useEditRecordData(recordId: string | null) {
  const tenantOrgId = useTenantOrganizationId();

  const recordQuery = useQuery({
    queryKey: ['edit-record', recordId, tenantOrgId ?? ''],
    queryFn: () => fetchRecordWithModule(recordId!),
    enabled: !!recordId,
    staleTime: 0,
  });

  /** Prefer joined module id, else FK — never leave dependents disabled while a row exists. */
  const moduleId = moduleDependencyId(recordQuery.data ?? undefined);

  const dependentQueries = useQueries({
    queries: [
      {
        queryKey: queryKeys.fields.byModule(moduleId || ''),
        queryFn: () => fetchFieldsForModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 5 * 60_000,
      },
      {
        queryKey: queryKeys.layouts.default(moduleId || ''),
        queryFn: () => fetchDefaultLayout(moduleId!),
        enabled: !!moduleId,
        staleTime: 5 * 60_000,
      },
    ],
  });

  const [fieldsQuery, layoutQuery] = dependentQueries;

  const depsEnabled = !!moduleId && recordQuery.isSuccess;

  const depsComplete =
    !depsEnabled || (fieldsQuery.isFetched && layoutQuery.isFetched);

  const isLoading =
    recordQuery.isPending ||
    recordQuery.isFetching ||
    (recordQuery.isSuccess && depsEnabled && !depsComplete);

  const data: EditRecordData | null =
    recordQuery.isSuccess && depsComplete && recordQuery.data
      ? {
          record: recordQuery.data,
          fields:
            depsEnabled && fieldsQuery.isSuccess ? (fieldsQuery.data ?? []) : [],
          layout:
            depsEnabled && layoutQuery.isSuccess
              ? layoutQuery.data ?? null
              : null,
        }
      : null;

  /** Row exists post-fetch but neither join nor FK gives a module (should be rare — import/tenant mismatch). */
  const moduleMetadataMissing =
    recordQuery.isSuccess &&
    depsComplete &&
    !!recordQuery.data &&
    !moduleDependencyId(recordQuery.data);

  const dependentsFailed =
    recordQuery.isSuccess &&
    depsEnabled &&
    depsComplete &&
    (fieldsQuery.isError || layoutQuery.isError);

  return {
    data,
    isLoading: !!isLoading,
    /** Loaded `crm_records` row — present while fields/layout are still fetching. */
    recordRow: (recordQuery.data ?? null) as EditRecordRow | null,
    /** Only the primary lookup failing (vs layout/metadata errors). */
    recordQueryError: recordQuery.error ?? null,
    error: recordQuery.error || fieldsQuery.error || layoutQuery.error,
    moduleMetadataMissing,
    dependentsFailed,
  };
}
