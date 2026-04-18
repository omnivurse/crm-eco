/**
 * CRM feature flag resolver.
 *
 * Precedence (first match wins):
 *   1. Per-user override in `profiles.ui_preferences` — instant escape hatch.
 *   2. Org-scoped row in `crm_feature_flags` (if any).
 *   3. Global default row in `crm_feature_flags` (organization_id IS NULL).
 *   4. Hard-coded fallback passed via `fallback` arg.
 *
 * All checks are defensive: any DB failure falls back to `fallback` so a
 * broken flags table can never take the app down.
 */

import { createCrmClient } from './queries';
import type { CrmProfile, CrmUiPreferences } from './types';

export type CrmFeatureFlagKey =
  | 'crm.layout.v2'
  | (string & { readonly __brand?: never });

interface ResolvedFlag {
  enabled: boolean;
  source: 'user' | 'org' | 'global' | 'fallback';
}

/**
 * Cheap, synchronous check that only inspects the profile's `ui_preferences`.
 * Use this in the render path after you've already resolved the org/global
 * flag server-side — it lets users flip layouts instantly.
 */
export function isUserOptedIntoLayoutV2(profile: Pick<CrmProfile, 'ui_preferences'> | null | undefined): boolean {
  const prefs = profile?.ui_preferences as CrmUiPreferences | null | undefined;
  return prefs?.crm_layout_v2 === true;
}

/**
 * Full resolver. Reads org + global rows from `crm_feature_flags` once, then
 * applies the user override. Safe to call from RSCs.
 */
export async function resolveCrmFeatureFlag(
  key: CrmFeatureFlagKey,
  profile: Pick<CrmProfile, 'organization_id' | 'ui_preferences'> | null | undefined,
  fallback = false,
): Promise<ResolvedFlag> {
  // 1. Per-user override — only honored for known user-togglable flags.
  if (key === 'crm.layout.v2') {
    const prefs = profile?.ui_preferences as CrmUiPreferences | null | undefined;
    if (typeof prefs?.crm_layout_v2 === 'boolean') {
      return { enabled: prefs.crm_layout_v2, source: 'user' };
    }
  }

  try {
    const supabase = await createCrmClient();
    const orgId = profile?.organization_id ?? null;

    const { data, error } = await supabase
      .from('crm_feature_flags')
      .select('organization_id, enabled')
      .eq('flag_key', key)
      .or(orgId ? `organization_id.eq.${orgId},organization_id.is.null` : 'organization_id.is.null');

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[feature-flags] resolve failed, using fallback:', error.message);
      }
      return { enabled: fallback, source: 'fallback' };
    }

    const rows = (data || []) as Array<{ organization_id: string | null; enabled: boolean }>;
    const orgRow = rows.find((r) => r.organization_id === orgId && orgId !== null);
    if (orgRow) return { enabled: orgRow.enabled, source: 'org' };

    const globalRow = rows.find((r) => r.organization_id === null);
    if (globalRow) return { enabled: globalRow.enabled, source: 'global' };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[feature-flags] unexpected error, using fallback:', err);
    }
  }

  return { enabled: fallback, source: 'fallback' };
}

/**
 * Convenience wrapper specific to the Layout V2 rollout.
 * Returns `true` when the user should see the new record detail shell.
 */
export async function isLayoutV2Enabled(
  profile: Pick<CrmProfile, 'organization_id' | 'ui_preferences'> | null | undefined,
): Promise<boolean> {
  const flag = await resolveCrmFeatureFlag('crm.layout.v2', profile, false);
  return flag.enabled;
}
