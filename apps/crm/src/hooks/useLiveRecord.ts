'use client';

/**
 * useLiveRecord — subscribe to Postgres changes for a single record and
 * its dependent tables (`crm_notes`, `crm_tasks`, `crm_attachments`,
 * `crm_stage_history`, `crm_audit_logs`) so V2 can reflect co-author
 * edits without manual refresh.
 *
 * Design notes:
 *   - Uses a dedicated Supabase Realtime channel keyed by record id,
 *     independent of the global `RealtimeProvider`. Keeping this isolated
 *     avoids coupling record-detail fan-out to the app-wide throttle.
 *   - Fires a single `onAny` callback with the table + event type so
 *     consumers (the V2 shell) can decide whether to:
 *       - `router.refresh()` the RSC (for record field updates), or
 *       - refresh insights / timeline (for dependent table inserts).
 *   - Accepts `currentUserId` so the hook can short-circuit self-originated
 *     events and avoid spurious "someone else updated this" toasts.
 */

import { useEffect, useRef } from 'react';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';

export type LiveRecordEventType = 'INSERT' | 'UPDATE' | 'DELETE';
export type LiveRecordTable =
  | 'crm_records'
  | 'crm_notes'
  | 'crm_tasks'
  | 'crm_attachments'
  | 'crm_stage_history'
  | 'crm_audit_logs';

export interface LiveRecordEvent {
  table: LiveRecordTable;
  type: LiveRecordEventType;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  /** True when the event originated from the current user. */
  isSelf: boolean;
}

export interface UseLiveRecordOptions {
  recordId: string;
  enabled?: boolean;
  /** Current user id so self-originated events can be flagged. */
  currentUserId?: string | null;
  onEvent: (event: LiveRecordEvent) => void;
}

/**
 * Tables where the record id lives on a different column than `id`.
 * `crm_records` itself matches on `id`, everything else on `record_id`.
 */
const RECORD_FK_TABLES: LiveRecordTable[] = [
  'crm_notes',
  'crm_tasks',
  'crm_attachments',
  'crm_stage_history',
  'crm_audit_logs',
];

function didSelfOriginate(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  currentUserId?: string | null,
): boolean {
  if (!currentUserId) return false;
  const row =
    ((payload.new as Record<string, unknown> | undefined) ?? (payload.old as Record<string, unknown> | undefined)) ??
    {};
  const candidates = [
    row.created_by,
    row.updated_by,
    row.actor_id,
    row.author_id,
    row.user_id,
    row.owner_id,
  ];
  return candidates.some((v) => typeof v === 'string' && v === currentUserId);
}

export function useLiveRecord({
  recordId,
  enabled = true,
  currentUserId,
  onEvent,
}: UseLiveRecordOptions): void {
  // Stable onEvent ref so callers can pass inline closures without
  // re-subscribing every render.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !recordId) return;

    const channel: RealtimeChannel = supabase.channel(
      `record-live:${recordId}`,
    );

    // Main record row — filter by id.
    (channel as unknown as { on: (t: string, f: object, cb: unknown) => void }).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'crm_records',
        filter: `id=eq.${recordId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        onEventRef.current({
          table: 'crm_records',
          type: payload.eventType as LiveRecordEventType,
          new: (payload.new as Record<string, unknown>) ?? null,
          old: (payload.old as Record<string, unknown>) ?? null,
          isSelf: didSelfOriginate(payload, currentUserId),
        });
      },
    );

    // Dependent tables — filter by record_id.
    for (const table of RECORD_FK_TABLES) {
      (channel as unknown as { on: (t: string, f: object, cb: unknown) => void }).on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `record_id=eq.${recordId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          onEventRef.current({
            table,
            type: payload.eventType as LiveRecordEventType,
            new: (payload.new as Record<string, unknown>) ?? null,
            old: (payload.old as Record<string, unknown>) ?? null,
            isSelf: didSelfOriginate(payload, currentUserId),
          });
        },
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [recordId, enabled, currentUserId]);
}
