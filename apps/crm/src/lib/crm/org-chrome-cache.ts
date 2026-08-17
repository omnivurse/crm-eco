/**
 * Short-lived org chrome cache (modules + field counts + nav profile).
 *
 * These rows are tenant-scoped configuration, not member/PHI records.
 * Keys are organization IDs only. Empty module lists are never stored so a
 * first-login seed race cannot hide nav for 45s.
 *
 * L1 is an in-process Map (warm serverless instances). React.cache() still
 * dedupes within a single request. Cross-request Next/unstable_cache is not
 * used here because the loaders read cookies().
 */

import { cache } from 'react';
import { createCrmClient } from './queries';
import { resolveCrmNavProfile } from './feature-flags';
import type { CrmModule, CrmProfile } from './types';
import type { NavProfile } from './nav-profile';
import {
  invalidateOrgChromeEntry,
  readOrgChromeEntry,
  writeOrgChromeEntry,
  type OrgChrome,
  type OrgChromeEntry,
} from './org-chrome-cache-store';

export {
  ORG_CHROME_TTL_MS,
  readOrgChromeEntry,
  writeOrgChromeEntry,
  invalidateOrgChromeEntry,
} from './org-chrome-cache-store';
export type { OrgChrome, OrgChromeEntry } from './org-chrome-cache-store';

function chromeStore(): Map<string, OrgChromeEntry> {
  const g = globalThis as typeof globalThis & {
    __crmOrgChrome?: Map<string, OrgChromeEntry>;
  };
  if (!g.__crmOrgChrome) g.__crmOrgChrome = new Map();
  return g.__crmOrgChrome;
}

type ModuleRow = CrmModule & {
  crm_fields?: Array<{ count: number }> | null;
};

async function loadModulesWithFieldCounts(
  orgId: string,
): Promise<{ modules: CrmModule[]; fieldCounts: Record<string, number> }> {
  const supabase = await createCrmClient();
  const { data, error } = await supabase
    .from('crm_modules')
    .select('*, crm_fields(count)')
    .eq('org_id', orgId)
    .eq('is_enabled', true)
    .order('display_order');

  if (error) throw error;

  const fieldCounts: Record<string, number> = {};
  const modules: CrmModule[] = [];
  for (const row of (data || []) as ModuleRow[]) {
    const count = row.crm_fields?.[0]?.count;
    if (typeof count === 'number') fieldCounts[row.id] = count;
    const { crm_fields, ...module } = row;
    void crm_fields;
    modules.push(module);
  }
  return { modules, fieldCounts };
}

async function loadOrgChrome(
  orgId: string,
  profile: Pick<CrmProfile, 'organization_id' | 'ui_preferences'>,
): Promise<OrgChrome> {
  const [modulesResult, navResult] = await Promise.allSettled([
    loadModulesWithFieldCounts(orgId),
    resolveCrmNavProfile(profile),
  ]);

  const bundle =
    modulesResult.status === 'fulfilled'
      ? modulesResult.value
      : { modules: [] as CrmModule[], fieldCounts: {} as Record<string, number> };
  if (modulesResult.status === 'rejected') {
    console.error('[CRM] org chrome modules failed:', modulesResult.reason);
  }

  const navProfile: NavProfile =
    navResult.status === 'fulfilled' ? navResult.value : 'full';

  return {
    modules: bundle.modules,
    fieldCounts: bundle.fieldCounts,
    navProfile,
  };
}

/**
 * Request-deduped org chrome. Warm instances reuse the last 45s for the same org.
 */
export const getOrgChrome = cache(
  async (
    orgId: string,
    profile: Pick<CrmProfile, 'organization_id' | 'ui_preferences'>,
  ): Promise<OrgChrome> => {
    const store = chromeStore();
    const cached = readOrgChromeEntry(store, orgId, Date.now());
    if (cached) return cached;

    const value = await loadOrgChrome(orgId, profile);
    writeOrgChromeEntry(store, orgId, value, Date.now());
    return value;
  },
);

export function invalidateOrgChrome(orgId: string): void {
  invalidateOrgChromeEntry(chromeStore(), orgId);
}

/** Used after first-login module seed so the next read is live. */
export async function reloadOrgChromeAfterSeed(
  orgId: string,
  profile: Pick<CrmProfile, 'organization_id' | 'ui_preferences'>,
): Promise<OrgChrome> {
  invalidateOrgChrome(orgId);
  const value = await loadOrgChrome(orgId, profile);
  writeOrgChromeEntry(chromeStore(), orgId, value, Date.now());
  return value;
}
