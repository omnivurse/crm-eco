/**
 * Pre-login tenant + branding resolution for the CRM sign-in screen.
 *
 * Mirrors the member-portal white-label pattern: resolve the org from the
 * request hostname, sticky org cookie, or an explicit ?org=slug hint — then
 * read organizations.branding via a service-role client (no RLS grant needed).
 */
import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { ACTIVE_ORG_COOKIE, extractSubdomain } from '@/lib/tenant';
import type { LoginBrandingContext } from '@/lib/login-branding-types';

export type { LoginBrandingContext };

interface OrgRow {
  id: string;
  slug: string | null;
  name: string | null;
  branding: Record<string, unknown> | null;
  subdomain: string | null;
  domain: string | null;
}

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

function baseDomain(host: string): string {
  const parts = host.split('.');
  return parts.length <= 2 ? host : parts.slice(-2).join('.');
}

async function fetchOrgById(
  service: ReturnType<typeof createServiceRoleClient>,
  id: string,
): Promise<OrgRow | null> {
  const { data } = await service
    .from('organizations')
    .select('id, slug, name, branding, subdomain, domain')
    .eq('id', id)
    .maybeSingle();
  return (data as OrgRow | null) ?? null;
}

async function fetchOrgBySlug(
  service: ReturnType<typeof createServiceRoleClient>,
  slug: string,
): Promise<OrgRow | null> {
  const { data } = await service
    .from('organizations')
    .select('id, slug, name, branding, subdomain, domain')
    .eq('slug', slug)
    .maybeSingle();
  return (data as OrgRow | null) ?? null;
}

async function fetchOrgBySubdomain(
  service: ReturnType<typeof createServiceRoleClient>,
  subdomain: string,
): Promise<OrgRow | null> {
  const { data } = await service
    .from('organizations')
    .select('id, slug, name, branding, subdomain, domain')
    .eq('subdomain', subdomain)
    .maybeSingle();
  return (data as OrgRow | null) ?? null;
}

async function resolveOrgByHost(
  service: ReturnType<typeof createServiceRoleClient>,
  host: string,
): Promise<OrgRow | null> {
  const { data: exact } = await service
    .from('organizations')
    .select('id, slug, name, branding, subdomain, domain')
    .or(`domain.eq.${host},subdomain.eq.${host}`)
    .limit(1)
    .maybeSingle();
  if (exact) return exact as OrgRow;

  const base = baseDomain(host);
  const { data: byBase } = await service
    .from('organizations')
    .select('id, slug, name, branding, subdomain, domain')
    .ilike('domain', `%${base}`)
    .limit(1)
    .maybeSingle();
  return (byBase as OrgRow | null) ?? null;
}

function toContext(row: OrgRow): LoginBrandingContext {
  return {
    organizationId: row.id,
    organizationSlug: row.slug,
    orgName: row.name,
    branding: (row.branding ?? {}) as Record<string, unknown>,
  };
}

/**
 * Resolve login-screen branding. Optional orgSlug comes from ?org= on the page.
 * Cached per request.
 */
export const getLoginBrandingContext = cache(
  async (orgSlug?: string | null): Promise<LoginBrandingContext | null> => {
    let service: ReturnType<typeof createServiceRoleClient>;
    try {
      service = createServiceRoleClient();
    } catch {
      return null;
    }

    try {
      if (orgSlug?.trim()) {
        const bySlug = await fetchOrgBySlug(service, orgSlug.trim());
        if (bySlug) return toContext(bySlug);
      }

      const cookieStore = await cookies();
      const cookieOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
      if (cookieOrgId) {
        const byCookie = await fetchOrgById(service, cookieOrgId);
        if (byCookie) return toContext(byCookie);
      }

      const host = await resolveRequestHost();
      if (host) {
        const byHost = await resolveOrgByHost(service, host);
        if (byHost) return toContext(byHost);

        const sub = extractSubdomain(host);
        if (sub) {
          const bySub = await fetchOrgBySubdomain(service, sub);
          if (bySub) return toContext(bySub);
        }
      }
    } catch (err) {
      console.error('[getLoginBrandingContext]', err);
    }

    return null;
  },
);
