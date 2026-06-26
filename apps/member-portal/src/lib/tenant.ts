import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';

export interface PortalTenant {
  organizationId: string;
  branding: Record<string, unknown>;
  /** Org display name — useful for the pre-login sign-in screen on a tenant domain. */
  orgName: string | null;
}

/**
 * Resolves the portal's tenant (organization) + its canonical branding
 * (organizations.branding jsonb) for server-side theming.
 *
 * WHITE-LABEL RESOLUTION ORDER:
 *  1. AUTHENTICATED member → their own organization (post-login is always the
 *     member's org, never the domain's).
 *  2. PRE-LOGIN / public → the organization that owns the REQUEST HOSTNAME, so a
 *     tenant domain (e.g. members.payitforwardhealth.com) themes its own sign-in
 *     and public pages. Matched by exact organizations.domain/subdomain first,
 *     then by registrable base domain (members.X / enroll.X → the org owning X).
 *
 * Branding reads use a service-role client scoped to a single org id (portal
 * members have no RLS grant on organizations). Returns null only when neither a
 * member nor a host-matched org can be resolved (→ theme.css defaults).
 *
 * NOTE: visible white-label requires the org to actually have branding populated
 * (organizations.branding: logo/colors/company_name). With empty branding the
 * resolver still returns the org (orgName usable) but CSS falls through to defaults.
 *
 * Cached per request via React's `cache()`.
 */
export const getPortalTenant = cache(async (): Promise<PortalTenant | null> => {
  // Branding resolution must NEVER crash a render. If the service-role client
  // can't be constructed — e.g. SUPABASE_SERVICE_ROLE_KEY is absent in a
  // preview/build environment where it (correctly) isn't scoped — degrade to
  // default theming instead of throwing. The root layout treats null as
  // "fall through to theme.css defaults". When the key IS present (production)
  // behaviour is unchanged.
  let service: ReturnType<typeof createServiceRoleClient>;
  try {
    service = createServiceRoleClient();
  } catch {
    return null;
  }

  // (1) Authenticated member → their org.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const ctx = await getMemberForUser(supabase, user.id);
    const organizationId = ctx?.member.organization_id;
    if (organizationId) {
      const { data } = await service
        .from('organizations')
        .select('branding, name')
        .eq('id', organizationId)
        .maybeSingle();
      return {
        organizationId,
        branding: (data?.branding ?? {}) as Record<string, unknown>,
        orgName: (data?.name as string) ?? null,
      };
    }
  }

  // (2) Pre-login / public → resolve the org from the request hostname.
  const host = await resolveRequestHost();
  if (host) {
    const org = await resolveOrgByHost(service, host);
    if (org) {
      return {
        organizationId: org.id,
        branding: (org.branding ?? {}) as Record<string, unknown>,
        orgName: (org.name as string) ?? null,
      };
    }
  }

  return null;
});

/** The incoming request host (proxy-aware), lowercased and without port. */
async function resolveRequestHost(): Promise<string | null> {
  try {
    const h = await headers();
    const raw = h.get('x-forwarded-host') ?? h.get('host');
    if (!raw) return null;
    return raw.split(',')[0].trim().toLowerCase().split(':')[0] || null;
  } catch {
    return null;
  }
}

/** Registrable base domain: last two labels (members.payitforwardhealth.com → payitforwardhealth.com). */
function baseDomain(host: string): string {
  const parts = host.split('.');
  return parts.length <= 2 ? host : parts.slice(-2).join('.');
}

/**
 * Find the organization that owns a hostname. Exact domain/subdomain match first;
 * then any org whose domain shares the request's registrable base domain (so
 * members.X and enroll.X both resolve to the org that owns X). Never throws.
 */
async function resolveOrgByHost(
  service: any,
  host: string,
): Promise<{ id: string; branding: unknown; name: string | null } | null> {
  try {
    const { data: exact } = await service
      .from('organizations')
      .select('id, branding, name')
      .or(`domain.eq.${host},subdomain.eq.${host}`)
      .limit(1)
      .maybeSingle();
    if (exact) return exact;

    const base = baseDomain(host);
    const { data: byBase } = await service
      .from('organizations')
      .select('id, branding, name')
      .ilike('domain', `%${base}`)
      .limit(1)
      .maybeSingle();
    if (byBase) return byBase;

    return null;
  } catch {
    return null;
  }
}
