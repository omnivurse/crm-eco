'use client';

import type { CrmRecord } from '@/lib/crm/types';
import {
  markLocalRecordSaveFinished,
  markLocalRecordSaveStarted,
} from '@/lib/crm/local-record-saves';

/**
 * Update a CRM record via the Next.js API so server-side logic always runs:
 * column sync from JSONB, normalization, workflows, scoring, PHI audit, cache revalidation.
 */
export async function patchCrmRecord(
  recordId: string,
  body: Record<string, unknown>
): Promise<CrmRecord> {
  // Register with the local-save registry so `useLiveRecord` attributes
  // the resulting Realtime UPDATE to this tab (see local-record-saves.ts).
  let savedUpdatedAt: string | null = null;
  markLocalRecordSaveStarted(recordId);
  try {
    const res = await fetch(`/api/crm/records/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      id?: string;
      updated_at?: string | null;
      error?: string;
      code?: string;
    };

    if (!res.ok) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : `Request failed (${res.status})`;
      throw new Error(msg);
    }

    if (!json?.id) {
      throw new Error('Invalid response from server');
    }

    if (typeof json.updated_at === 'string') savedUpdatedAt = json.updated_at;
    return json as CrmRecord;
  } finally {
    markLocalRecordSaveFinished(recordId, savedUpdatedAt);
  }
}
