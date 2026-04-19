'use client';

/**
 * useSyncReceiptRealtime — cross-device fan-out for sync receipts.
 *
 * Complements `useSyncBroadcast` (which only covers sibling tabs on
 * the same device). Subscribes to Supabase Realtime INSERTs on
 * `crm_idempotency_keys` filtered by `organization_id`, so every
 * device signed in to the same org reacts when any other device
 * lands a mutation. Typical consumer:
 *
 *   ```ts
 *   const { record } = useRecord(id);
 *   useSyncReceiptRealtime({
 *     organizationId: profile.organization_id,
 *     onReceipt: (evt) => {
 *       if (evt.path.includes(`/records/${record.id}`)) router.refresh();
 *     },
 *   });
 *   ```
 *
 * Schema knowledge:
 *   The table is published by migration
 *   `202604210002_crm_idempotency_realtime.sql` with REPLICA
 *   IDENTITY FULL, so the payload's `new` object is the full row.
 *
 * Deduplication with BroadcastChannel:
 *   Same-device same-tab: the origin tab writes the receipt locally
 *     before the Supabase INSERT propagates back, so the inbound
 *     realtime event's receiptId matches one we've already seen.
 *   Same-device sibling tab: BroadcastChannel gets there first
 *     because it's in-process.
 *   Cross-device: realtime is the only delivery path.
 *   Net effect: consumers should idempotently handle duplicate
 *   receiptIds — this hook does not dedupe on its own because the
 *   consumer usually already de-dupes via `receipt-log` or by
 *   letting React Query / RSC cache coalesce the resulting refresh.
 */

import { useEffect, useRef } from 'react';
import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
} from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';

export interface SyncReceiptRealtimeEvent {
  /** Ledger row id — NOT the idempotency key. */
  rowId: string;
  /** Client-generated idempotency key. */
  key: string;
  method: string;
  path: string;
  statusCode: number;
  traceId: string | null;
  createdAt: string;
}

export interface UseSyncReceiptRealtimeOptions {
  organizationId: string | null | undefined;
  enabled?: boolean;
  onReceipt: (event: SyncReceiptRealtimeEvent) => void;
}

export function useSyncReceiptRealtime({
  organizationId,
  enabled = true,
  onReceipt,
}: UseSyncReceiptRealtimeOptions): void {
  // Ref-latest so callers aren't forced to memoise `onReceipt`.
  // Populated via effect so we don't violate react-hooks/refs.
  const handlerRef = useRef(onReceipt);
  useEffect(() => {
    handlerRef.current = onReceipt;
  }, [onReceipt]);

  useEffect(() => {
    if (!enabled || !organizationId) return;

    const channel: RealtimeChannel = supabase
      .channel(`crm-sync-receipts-${organizationId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_idempotency_keys',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
          const row = payload.new;
          if (!row || typeof row.id !== 'string') return;
          try {
            handlerRef.current({
              rowId: row.id as string,
              key: (row.key as string) ?? '',
              method: (row.method as string) ?? '',
              path: (row.path as string) ?? '',
              statusCode: (row.status_code as number) ?? 0,
              traceId: (row.trace_id as string | null) ?? null,
              createdAt:
                (row.created_at as string) ?? new Date().toISOString(),
            });
          } catch {
            /* never let a consumer take down the channel */
          }
        },
      );
    channel.subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [organizationId, enabled]);
}
