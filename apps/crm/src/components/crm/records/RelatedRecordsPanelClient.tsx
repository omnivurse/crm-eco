'use client';

/**
 * Client wrapper for `RelatedRecordsPanel`. The panel itself is presentational —
 * it expects callers to supply `onLinkRecord` / `onUnlink` / `onSetPrimary` /
 * `onSearchRecords`. The record detail page renders the panel from a server
 * component, so without this wrapper the "Link Record" button never appears
 * (the panel hides it when no `onLinkRecord` is provided) and "clicking on
 * Related does nothing".
 *
 * This component:
 *   - Holds the linked-records list in client state and refreshes after each
 *     mutation, so links appear / disappear without a hard navigation.
 *   - Wires the link / unlink / set-primary handlers to the REST endpoints in
 *     `/api/crm/record-links`.
 *   - Wires record search to `/api/crm/search?q=…` (global smart search —
 *     `/api/crm/records` requires module_key per record and was never valid here).
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CrmLinkedRecord } from '@/lib/crm/types';
import { RelatedRecordsPanel, type LinkCandidate } from './RelatedRecordsPanel';

interface Props {
  recordId: string;
  initialLinkedRecords: CrmLinkedRecord[];
  className?: string;
}

export function RelatedRecordsPanelClient({ recordId, initialLinkedRecords, className }: Props) {
  const router = useRouter();
  const [linkedRecords, setLinkedRecords] = useState<CrmLinkedRecord[]>(initialLinkedRecords);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/record-links?recordId=${encodeURIComponent(recordId)}`);
      if (!res.ok) return;
      const next = (await res.json()) as CrmLinkedRecord[];
      setLinkedRecords(next);
    } catch {
      // Best-effort; swallow.
    }
  }, [recordId]);

  const handleLinkRecord = useCallback(
    async (targetRecordId: string, linkType: string, isPrimary?: boolean) => {
      const res = await fetch('/api/crm/record-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_record_id: recordId,
          target_record_id: targetRecordId,
          link_type: linkType,
          is_primary: isPrimary ?? false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to link record');
      }
      await refresh();
      router.refresh();
    },
    [recordId, refresh, router]
  );

  const handleUnlink = useCallback(
    async (linkId: string) => {
      const res = await fetch(`/api/crm/record-links?id=${encodeURIComponent(linkId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to unlink record');
      }
      await refresh();
      router.refresh();
    },
    [refresh, router]
  );

  const handleSetPrimary = useCallback(
    async (linkId: string, isPrimary: boolean) => {
      const res = await fetch('/api/crm/record-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: linkId, is_primary: isPrimary }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to set primary');
      }
      await refresh();
      router.refresh();
    },
    [refresh, router]
  );

  const handleSearchRecords = useCallback(
    async (query: string): Promise<LinkCandidate[]> => {
      const trimmed = query.trim();
      if (!trimmed) return [];
      const res = await fetch(`/api/crm/search?q=${encodeURIComponent(trimmed)}&limit=25`);
      if (!res.ok) return [];
      const json = (await res.json()) as {
        results: Array<{
          id: string;
          title: string;
          subtitle?: string;
          moduleKey: string;
        }>;
      };
      const rows = json?.results ?? [];
      return rows
        .filter((r) => r.id !== recordId)
        .map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          module_key: r.moduleKey,
        }));
    },
    [recordId]
  );

  return (
    <RelatedRecordsPanel
      recordId={recordId}
      linkedRecords={linkedRecords}
      onLinkRecord={handleLinkRecord}
      onUnlink={handleUnlink}
      onSetPrimary={handleSetPrimary}
      onSearchRecords={handleSearchRecords}
      className={className}
    />
  );
}
