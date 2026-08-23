/**
 * Helpers for GET /api/crm/records/field-values (Road to Ten DE-2).
 *
 * Kept out of the route module on purpose: Next's route validator rejects
 * non-handler exports from `route.ts`, and the Quick Create client half
 * (another change) needs the same response shape.
 */

/** Mirrors the RPC's own guard — crm_fields.key shape. Checked in the route so a bad key is a 400, not a 500. */
export const FIELD_KEY_PATTERN = /^[a-z0-9_]{1,64}$/;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export interface FieldValue {
  value: string;
  count: number;
}

/** Response body of GET /api/crm/records/field-values. */
export interface FieldValuesResponse {
  module_key: string;
  key: string;
  /** count desc, then value asc — spellings exactly as stored. */
  values: FieldValue[];
  /** sum of the returned counts */
  total: number;
}

/** Parses the `limit` query param: absent → default; non-integer or out of 1..MAX → null (400). */
export function parseLimit(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return DEFAULT_LIMIT;
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) return null;
  return n;
}

/** Normalises the RPC rows (value text, count bigint → number|string over PostgREST) into the response shape. */
export function parseFieldValuesRpcResult(raw: unknown): FieldValue[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldValue[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const value = (row as { value?: unknown }).value;
    const count = Number((row as { count?: unknown }).count);
    if (typeof value !== 'string' || value.trim() === '') continue;
    if (!Number.isFinite(count) || count < 0) continue;
    out.push({ value, count });
  }
  return out;
}
