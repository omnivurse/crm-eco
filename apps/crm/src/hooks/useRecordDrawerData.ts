'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import { useTenantOrganizationId } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase-client';
import { queryKeys } from '@/lib/query-keys';
import type { CrmRecord, CrmField } from '@/lib/crm/types';
import { resolveNoteSourceRecordIdsWithClient, moduleKeyFromJoinedRelation } from '@/lib/crm/note-aggregate';

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

type RecordRow = CrmRecord & { module?: { key: string } | null };

// Load by id + RLS only (same rationale as useEditRecordData).
async function fetchRecord(recordId: string): Promise<RecordRow | null> {
  const { data, error } = await supabase
    .from('crm_records')
    .select('*, module:crm_modules!crm_records_module_id_fkey(key)')
    .eq('id', recordId)
    // A trashed record reads as not-found so the drawer won't open it.
    .is('deleted_at' as never, null)
    .maybeSingle();

  if (error) throw error;
  return data as RecordRow | null;
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

// Fetch mini timeline (notes + tasks combined; notes may include linked lead/contact)
async function fetchMiniTimeline(record: RecordRow, recordId: string): Promise<TimelineEvent[]> {
  const moduleKey = moduleKeyFromJoinedRelation(record.module);
  const noteIds = await resolveNoteSourceRecordIdsWithClient(supabase, record, moduleKey);

  const [notesResult, tasksResult] = await Promise.all([
    supabase
      .from('crm_notes')
      .select('id, body, created_at, created_by')
      .in('record_id', noteIds)
      .is('deleted_at' as never, null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('crm_tasks')
      .select('id, title, status, due_at, created_at')
      .eq('record_id', recordId)
      .is('deleted_at' as never, null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const notes: TimelineEvent[] = (notesResult.data || []).map((n: any) => ({
    id: n.id,
    type: 'note' as const,
    timestamp: n.created_at,
    data: n,
  }));

  const tasks: TimelineEvent[] = (tasksResult.data || []).map((t: any) => ({
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
  const tenantOrgId = useTenantOrganizationId();

  const recordQuery = useQuery({
    queryKey: queryKeys.records.detail(recordId!, tenantOrgId),
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
        queryFn: () => fetchMiniTimeline(recordQuery.data!, recordId!),
        enabled: !!recordId && !!recordQuery.data,
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
