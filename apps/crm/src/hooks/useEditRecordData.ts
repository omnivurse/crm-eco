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
 * Load by id only — same contract as server `getRecordWithModule`:
 * rely on `crm_records` RLS for org/access. Filtering by TenantContext here
 * could false-null when layout org and RLS-visible rows drift (rare advisors).
 */
async function fetchRecordWithModule(recordId: string): Promise<EditRecordRow | null> {
  const { data, error } = await supabase
    .from('crm_records')
    .select(`
      *,
      module:crm_modules!crm_records_module_id_fkey(id, key, name, name_plural)
    `)
    .eq('id', recordId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const moduleData = Array.isArray(data.module) ? data.module[0] : data.module;

  return {
    ...data,
    module: moduleData,
  } as EditRecordRow;
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
  const { data, error } = await supabase
    .from('crm_layouts')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw error;
  return data as CrmLayout | null;
}

export function useEditRecordData(recordId: string | null) {
  const tenantOrgId = useTenantOrganizationId();

  const recordQuery = useQuery({
    queryKey: ['edit-record', recordId, tenantOrgId ?? ''],
    queryFn: () => fetchRecordWithModule(recordId!),
    enabled: !!recordId,
    staleTime: 0,
  });

  const moduleId = recordQuery.data?.module?.id;

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

  const isLoading =
    recordQuery.isLoading ||
    (recordQuery.data && (fieldsQuery.isLoading || layoutQuery.isLoading));

  const data: EditRecordData | null =
    recordQuery.data && fieldsQuery.data !== undefined && layoutQuery.data !== undefined
      ? {
          record: recordQuery.data,
          fields: fieldsQuery.data,
          layout: layoutQuery.data,
        }
      : null;

  return {
    data,
    isLoading: !!isLoading,
    /** Loaded `crm_records` row — present while fields/layout are still fetching. */
    recordRow: (recordQuery.data ?? null) as EditRecordRow | null,
    /** Only the primary lookup failing (vs layout/metadata errors). */
    recordQueryError: recordQuery.error ?? null,
    error: recordQuery.error || fieldsQuery.error || layoutQuery.error,
  };
}
