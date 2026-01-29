'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { queryKeys } from '@/lib/query-keys';
import type { CrmRecord, CrmField } from '@/lib/crm/types';

interface TimelineEvent {
  id: string;
  type: 'note' | 'task';
  timestamp: string;
  data: Record<string, unknown>;
}

export interface RecordDrawerData {
  record: CrmRecord;
  fields: CrmField[];
  timeline: TimelineEvent[];
}

// Create a singleton Supabase client for queries
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fetch record data
async function fetchRecord(recordId: string): Promise<CrmRecord | null> {
  const { data, error } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (error) throw error;
  return data as CrmRecord | null;
}

// Fetch fields for module
async function fetchFields(moduleId: string): Promise<CrmField[]> {
  const { data, error } = await supabase
    .from('crm_fields')
    .select('*')
    .eq('module_id', moduleId)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmField[];
}

// Fetch mini timeline (notes + tasks combined)
async function fetchMiniTimeline(recordId: string): Promise<TimelineEvent[]> {
  const [notesResult, tasksResult] = await Promise.all([
    supabase
      .from('crm_notes')
      .select('id, body, created_at, created_by')
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('crm_tasks')
      .select('id, title, status, due_at, created_at')
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const notes: TimelineEvent[] = (notesResult.data || []).map((n) => ({
    id: n.id,
    type: 'note' as const,
    timestamp: n.created_at,
    data: n,
  }));

  const tasks: TimelineEvent[] = (tasksResult.data || []).map((t) => ({
    id: t.id,
    type: 'task' as const,
    timestamp: t.created_at,
    data: t,
  }));

  return [...notes, ...tasks]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

export function useRecordDrawerData(recordId: string | null) {
  // First, fetch the record
  const recordQuery = useQuery({
    queryKey: queryKeys.records.detail(recordId!),
    queryFn: () => fetchRecord(recordId!),
    enabled: !!recordId,
    staleTime: 30_000, // 30 seconds fresh
  });

  const moduleId = recordQuery.data?.module_id;

  // Then fetch fields and timeline in parallel (dependent on record existing)
  const dependentQueries = useQueries({
    queries: [
      {
        queryKey: queryKeys.fields.byModule(moduleId || ''),
        queryFn: () => fetchFields(moduleId!),
        enabled: !!moduleId,
        staleTime: 5 * 60_000, // 5 minutes - fields rarely change
      },
      {
        queryKey: queryKeys.timeline.byRecord(recordId || ''),
        queryFn: () => fetchMiniTimeline(recordId!),
        enabled: !!recordId,
        staleTime: 10_000, // 10 seconds - timeline updates more often
      },
    ],
  });

  const [fieldsQuery, timelineQuery] = dependentQueries;

  const isLoading =
    recordQuery.isLoading ||
    (recordQuery.data && (fieldsQuery.isLoading || timelineQuery.isLoading));

  const data: RecordDrawerData | null =
    recordQuery.data && fieldsQuery.data && timelineQuery.data
      ? {
          record: recordQuery.data,
          fields: fieldsQuery.data,
          timeline: timelineQuery.data,
        }
      : null;

  return {
    data,
    isLoading: !!isLoading,
    error: recordQuery.error || fieldsQuery.error || timelineQuery.error,
  };
}
