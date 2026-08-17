import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getCachedCurrentProfile } from '@/lib/crm/queries';
import { getOrgChrome, reloadOrgChromeAfterSeed } from '@/lib/crm/org-chrome-cache';
import { ensureDefaultModules } from '@/lib/crm/seed';
import { getActiveTenant } from '@/lib/tenant';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';
import type { NavModule, NavProfile } from '@/lib/crm/nav-profile';

export interface CrmSession {
  profile: CrmProfile;
  organizationId: string;
  modules: CrmModule[];
  navModules: NavModule[];
  navProfile: NavProfile;
}

/**
 * One request-deduped session for the CRM shell. Safe to call from multiple
 * Suspense slots — React.cache() collapses them to a single profile + chrome load.
 */
export const loadCrmSession = cache(async function loadCrmSession(): Promise<CrmSession> {
  let profile: CrmProfile | null;
  try {
    profile = await getCachedCurrentProfile();
  } catch (error) {
    console.error('[CRM] Failed to get profile:', error);
    redirect('/crm-login?error=profile_fetch_failed');
  }

  if (!profile) {
    redirect('/crm-login');
  }

  const activeTenant = await getActiveTenant();
  const admittedViaTenant =
    activeTenant !== null &&
    ['owner', 'super_admin', 'admin', 'staff'].includes(activeTenant.role);

  if (!profile.crm_role && !admittedViaTenant) {
    redirect('/crm-login?error=no_crm_access');
  }

  const organizationId = profile.organization_id;
  if (
    !organizationId ||
    (typeof organizationId === 'string' && organizationId.trim() === '')
  ) {
    redirect('/crm-login?error=no_organization');
  }

  let chrome;
  try {
    chrome = await getOrgChrome(organizationId, profile);
  } catch (error) {
    console.error('[CRM] Failed to fetch org chrome:', error);
    chrome = { modules: [], fieldCounts: {}, navProfile: 'full' as const };
  }

  let modules = chrome.modules;
  let fieldCounts = chrome.fieldCounts;
  let navProfile = chrome.navProfile;

  if (modules.length === 0) {
    try {
      await ensureDefaultModules(organizationId);
      const seeded = await reloadOrgChromeAfterSeed(organizationId, profile);
      modules = seeded.modules;
      fieldCounts = seeded.fieldCounts;
      navProfile = seeded.navProfile;
    } catch (error) {
      console.error('[CRM] Failed to auto-seed modules:', error);
    }
  }

  const navModules: NavModule[] = modules.map((m) => ({
    key: m.key,
    name: m.name,
    name_plural: m.name_plural,
    icon: m.icon,
    is_enabled: m.is_enabled,
    display_order: m.display_order,
    field_count: fieldCounts[m.id],
  }));

  return { profile, organizationId, modules, navModules, navProfile };
});
