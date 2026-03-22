'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-client';
import { queryKeys } from '@/lib/query-keys';
import type { CrmRecord } from '@/lib/crm/types';

/** Full `crm_records` row + module (must match server reads — use `select('*')`). */
export type EditRecordRow = CrmRecord & {
  module: {
    id: string;
    key: string;
    name: string;
    name_plural: string | null;
  };
};

interface Field {
  id: string;
  key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  options?: string[];
}

export interface EditRecordData {
  record: EditRecordRow;
  fields: Field[];
}

// Fetch full row + module — same columns as getRecordWithModule / list queries
async function fetchRecordWithModule(recordId: string): Promise<EditRecordRow | null> {
  const { data, error } = await supabase
    .from('crm_records')
    .select(`
      *,
      module:crm_modules!crm_records_module_id_fkey(id, key, name, name_plural)
    `)
    .eq('id', recordId)
    .single();

  if (error) throw error;
  if (!data) return null;

  const moduleData = Array.isArray(data.module)
    ? data.module[0]
    : data.module;

  return {
    ...data,
    module: moduleData,
  } as EditRecordRow;
}

// Fetch fields for module
async function fetchEditFields(moduleId: string): Promise<Field[]> {
  const { data, error } = await supabase
    .from('crm_fields')
    .select('id, key, label, field_type:type, is_required:required, options')
    .eq('module_id', moduleId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data || []) as Field[];
}

export function useEditRecordData(recordId: string | null) {
  // First, fetch the record with module
  const recordQuery = useQuery({
    queryKey: ['edit-record', recordId],
    queryFn: () => fetchRecordWithModule(recordId!),
    enabled: !!recordId,
    staleTime: 0, // Always refetch — edits must show latest data
  });

  const moduleId = recordQuery.data?.module?.id;

  // Then fetch fields (dependent on record having module)
  const fieldsQuery = useQuery({
    queryKey: queryKeys.fields.byModule(moduleId || ''),
    queryFn: () => fetchEditFields(moduleId!),
    enabled: !!moduleId,
    staleTime: 5 * 60_000, // 5 minutes - fields rarely change
  });

  const isLoading =
    recordQuery.isLoading ||
    (recordQuery.data && fieldsQuery.isLoading);

  const data: EditRecordData | null =
    recordQuery.data && fieldsQuery.data
      ? {
          record: recordQuery.data,
          fields: fieldsQuery.data,
        }
      : null;

  return {
    data,
    isLoading: !!isLoading,
    error: recordQuery.error || fieldsQuery.error,
  };
}
