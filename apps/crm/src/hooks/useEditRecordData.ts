'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { queryKeys } from '@/lib/query-keys';

interface RecordData {
  id: string;
  title: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  data: Record<string, unknown>;
  module: {
    id: string;
    key: string;
    name: string;
    name_plural: string | null;
  };
}

interface Field {
  id: string;
  key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface EditRecordData {
  record: RecordData;
  fields: Field[];
}

// Create a singleton Supabase client for queries
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fetch record data with module info
async function fetchRecordWithModule(recordId: string): Promise<RecordData | null> {
  const { data, error } = await supabase
    .from('crm_records')
    .select(`
      id,
      title,
      email,
      phone,
      status,
      data,
      module:crm_modules(id, key, name, name_plural)
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
  } as RecordData;
}

// Fetch fields for module
async function fetchEditFields(moduleId: string): Promise<Field[]> {
  const { data, error } = await supabase
    .from('crm_fields')
    .select('id, key, label, field_type, is_required, options, placeholder')
    .eq('module_id', moduleId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as Field[];
}

export function useEditRecordData(recordId: string | null) {
  // First, fetch the record with module
  const recordQuery = useQuery({
    queryKey: ['edit-record', recordId],
    queryFn: () => fetchRecordWithModule(recordId!),
    enabled: !!recordId,
    staleTime: 30_000, // 30 seconds fresh
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
