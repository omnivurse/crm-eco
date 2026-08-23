/**
 * CRM feature flag resolver.
 *
 * Precedence (first match wins):
 *   1. Org-scoped row in `crm_feature_flags` (if any).
 *   2. Global default row in `crm_feature_flags` (organization_id IS NULL).
 *   3. Hard-coded fallback passed via `fallback` arg.
 *
 * All checks are defensive: any DB failure falls back to `fallback` so a
 * broken flags table can never take the app down.
 */

import { createCrmClient } from './queries';
import type { CrmProfile } from './types';

export type CrmFeatureFlagKey =
  | 'crm.layout.v2'
  | 'crm.nav.simple'
  | 'crm.lists.trim_surface'
  | (string & { readonly __brand?: never });

interface ResolvedFlag {
  enabled: boolean;
  source: 'org' | 'global' | 'fallback';
}

/**
 * Full resolver. Reads org + global rows from `crm_feature_flags` once.
 * Safe to call from RSCs.
 *
 * Road to Ten FB-4 (decision D8): the per-user `crm_layout_v2` override was
 * retired with the V1 record shell — V2 is the only record layout, so the
 * resolver no longer consults `profiles.ui_preferences`.
 */
export async function resolveCrmFeatureFlag(
  key: CrmFeatureFlagKey,
  profile: Pick<CrmProfile, 'organization_id' | 'ui_preferences'> | null | undefined,
  fallback = false,
): Promise<ResolvedFlag> {
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

/**
 * Tenant navigation profile (`crm.nav.simple`). Org/global rows only — there
 * is deliberately no per-user override: the whole org sees the same menu.
 * Resolves `'simple'` when the flag is enabled, `'full'` otherwise (and on
 * any DB failure, so a broken flags table can never hide navigation).
 */
export async function resolveCrmNavProfile(
  profile: Pick<CrmProfile, 'organization_id' | 'ui_preferences'> | null | undefined,
): Promise<'simple' | 'full'> {
  const flag = await resolveCrmFeatureFlag('crm.nav.simple', profile, false);
  return flag.enabled ? 'simple' : 'full';
}

/**
 * Road to Ten LS-9 (decision D11): trim the PIFH list surface — the
 * Zoho-leftover related-module filter groups and the pipeline/schedule view
 * modes — down to what a health-share desk actually uses.
 *
 * Hidden, never removed: both surfaces keep a "Show all" / "More views"
 * disclosure, and anything already active stays visible. Default `false`, so
 * an org without a row (and any DB failure) sees today's full surface.
 */
export async function isListSurfaceTrimEnabled(
  profile: Pick<CrmProfile, 'organization_id' | 'ui_preferences'> | null | undefined,
): Promise<boolean> {
  const flag = await resolveCrmFeatureFlag('crm.lists.trim_surface', profile, false);
  return flag.enabled;
}
