/**
 * Pure org-chrome Map helpers. Kept free of Next/Supabase so unit tests
 * can cover TTL and tenant-key isolation without importing server-only.
 */

import type { CrmModule } from './types';
import type { NavProfile } from './nav-profile';

export const ORG_CHROME_TTL_MS = 45_000;

export interface OrgChrome {
  modules: CrmModule[];
  fieldCounts: Record<string, number>;
  navProfile: NavProfile;
}

export interface OrgChromeEntry {
  value: OrgChrome;
  exp: number;
}

export function readOrgChromeEntry(
  store: Map<string, OrgChromeEntry>,
  orgId: string,
  now: number,
): OrgChrome | null {
  const hit = store.get(orgId);
  if (!hit || hit.exp <= now) return null;
  return hit.value;
}

export function writeOrgChromeEntry(
  store: Map<string, OrgChromeEntry>,
  orgId: string,
  value: OrgChrome,
  now: number,
  ttlMs = ORG_CHROME_TTL_MS,
): void {
  if (value.modules.length === 0) return;
  store.set(orgId, { value, exp: now + ttlMs });
}

export function invalidateOrgChromeEntry(
  store: Map<string, OrgChromeEntry>,
  orgId: string,
): void {
  store.delete(orgId);
}
