'use client';

import type { CrmRecord } from '@/lib/crm/types';

/**
 * Update a CRM record via the Next.js API so server-side logic always runs:
 * column sync from JSONB, normalization, workflows, scoring, PHI audit, cache revalidation.
 */
export async function patchCrmRecord(
  recordId: string,
  body: Record<string, unknown>
): Promise<CrmRecord> {
  const res = await fetch(`/api/crm/records/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as { id?: string; error?: string; code?: string };

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

  return json as CrmRecord;
}
