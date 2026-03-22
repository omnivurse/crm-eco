'use client';

import type { CrmRecord } from '@/lib/crm/types';

/**
 * Create a CRM record via the Next.js API so server-side logic always runs:
 * duplicate check, JSONB→indexed columns, workflows, scoring, revalidation.
 */
export async function postCrmRecord(body: Record<string, unknown>): Promise<CrmRecord> {
  const res = await fetch('/api/crm/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as { id?: string; error?: unknown; code?: string };

  if (!res.ok) {
    const msg =
      typeof json.error === 'string'
        ? json.error
        : Array.isArray(json.error)
          ? 'Validation failed'
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  if (!json?.id) {
    throw new Error('Invalid response from server');
  }

  return json as CrmRecord;
}
