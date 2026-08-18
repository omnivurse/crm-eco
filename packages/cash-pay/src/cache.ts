import type { GetRateDataPagedResult } from './types';

interface CacheEntry {
  expiresAt: number;
  value: GetRateDataPagedResult;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 200;

const store = new Map<string, CacheEntry>();

export function buildCacheKey(parts: {
  stateName: string;
  msaName: string;
  specialty: string;
  procedureCode?: string;
  category?: string;
  hospitalId?: number;
  id?: string;
  pageNumber: number;
  pageSize: number;
}): string {
  return [
    parts.stateName.trim().toLowerCase(),
    parts.msaName.trim().toLowerCase(),
    parts.specialty.trim().toLowerCase(),
    parts.procedureCode?.trim() || '',
    parts.category?.trim() || '',
    parts.hospitalId ?? '',
    parts.id ?? '',
    parts.pageNumber,
    parts.pageSize,
  ].join('|');
}

export function getCached(key: string): GetRateDataPagedResult | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function setCached(
  key: string,
  value: GetRateDataPagedResult,
  ttlMs = DEFAULT_TTL_MS,
): void {
  if (store.size >= MAX_ENTRIES) {
    // Drop oldest (Map insertion order)
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Test-only */
export function clearCache(): void {
  store.clear();
}
