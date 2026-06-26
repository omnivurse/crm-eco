import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tenant-org resolution for the PUBLIC enrollment form hosted by the admin
 * enrollment software (served on tenant-facing domains like
 * `enroll.payitforwardhealth.com`, never `admin.*`).
 *
 * Two entry shapes:
 *   - `/enroll/[slug]`  — org comes from the published `landing_pages` row (handled
 *     in the draft route directly).
 *   - `/enroll` (generic, no slug) — org is resolved from the request HOST
 *     (`organizations.domain`), falling back to the configured default org (PIFH).
 *
 * The client never supplies the org; it is always resolved server-side here and
 * baked into the signed draft cookie.
 */

/** PIFH — the default tenant for a generic enroll with no host/landing match. */
export const PIFH_DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export function getDefaultEnrollOrgId(): string {
  return process.env.ENROLLMENT_DEFAULT_ORG_ID || PIFH_DEFAULT_ORG_ID;
}

/** Normalize a Host header to a bare lowercase hostname (drops any port). */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.split(':')[0].trim().toLowerCase();
  return h || null;
}

/**
 * Resolve the tenant org for the GENERIC (no-slug) public enrollment form.
 * Order: `organizations.domain == <request host>` → `ENROLLMENT_DEFAULT_ORG_ID`.
 */
export async function resolveOrgByHost(
  supabase: SupabaseClient,
  host: string | null | undefined,
): Promise<string> {
  const h = normalizeHost(host);
  if (h) {
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .eq('domain', h)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return getDefaultEnrollOrgId();
}
