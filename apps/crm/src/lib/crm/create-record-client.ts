'use client';

import type { CrmRecord } from '@/lib/crm/types';

export interface CrmDuplicateCandidate {
  id: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
}

/**
 * Thrown by postCrmRecord so callers can branch on `code` (e.g. render the
 * server's duplicate candidates) instead of regex-matching the message.
 */
export class CrmRecordCreateError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly duplicates: CrmDuplicateCandidate[];
  constructor(message: string, status: number, code: string | null, duplicates: CrmDuplicateCandidate[] = []) {
    super(message);
    this.name = 'CrmRecordCreateError';
    this.status = status;
    this.code = code;
    this.duplicates = duplicates;
  }
}

/**
 * Create a CRM record via the Next.js API so server-side logic always runs:
 * duplicate check, JSONB→indexed columns, workflows, scoring, revalidation.
 * A 409 duplicate surfaces as CrmRecordCreateError{code:'DUPLICATE_RECORD', duplicates}.
 */
export async function postCrmRecord(body: Record<string, unknown>): Promise<CrmRecord> {
  const res = await fetch('/api/crm/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: unknown;
    code?: string;
    duplicates?: CrmDuplicateCandidate[];
  };

  if (!res.ok) {
    const msg =
      typeof json.error === 'string'
        ? json.error
        : Array.isArray(json.error)
          ? 'Validation failed'
          : `Request failed (${res.status})`;
    throw new CrmRecordCreateError(
      msg,
      res.status,
      typeof json.code === 'string' ? json.code : null,
      Array.isArray(json.duplicates) ? json.duplicates : [],
    );
  }

  if (!json?.id) {
    throw new CrmRecordCreateError('Invalid response from server', res.status, null);
  }

  return json as CrmRecord;
}
