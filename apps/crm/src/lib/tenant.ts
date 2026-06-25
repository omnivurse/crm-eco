/**
 * Tenant resolution helpers for the CRM (server-side only).
 *
 * Mirrors the admin app's resolver pattern (apps/admin/src/lib/tenant.ts) so a
 * user with multiple organization_members rows can switch the active org and
 * have all CRM data scope to it. Same cookie name (`dh_active_org`) as admin
 * so a switch in either app carries to the other in the same browser.
 *
 * Resolver order: header → cookie → subdomain → default membership →
 * first active membership.
 */
import 'server-only';

import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { createClient } from '@/lib/supabase-server';

export const ACTIVE_ORG_COOKIE = 'dh_active_org';
export const ACTIVE_ORG_HEADER = 'x-active-org';

const ROOT_DOMAINS = [
  'doublehelix.com',
  'crm.doublehelix.com',
  'doublehelixhub.com',
  'crm.doublehelixhub.com',
  'localhost',
  'localhost:3000',
];

export type TenantRole = 'owner' | 'super_admin' | 'admin' | 'staff' | 'read_only';

export interface ResolvedTenant {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  subdomain: string | null;
  /** Vanity domain (organizations.domain); needed for read-back in the
   *  provisioning UI that writes it. Null when no custom domain is set. */
  domain: string | null;
  role: TenantRole;
  isDefault: boolean;
  branding: Record<string, unknown>;
  plan: string;
}

export interface TenantMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  subdomain: string | null;
  /** Vanity domain (organizations.domain). Null when no custom domain is set. */
  domain: string | null;
  role: TenantRole;
  isDefault: boolean;
  plan: string;
  branding: Record<string, unknown>;
}

export function extractSubdomain(host: string | null): string | null {
  if (!host) return null;
  const lower = host.toLowerCase().split(':')[0];
  if (ROOT_DOMAINS.some((d) => lower === d.split(':')[0])) return null;

  for (const root of ROOT_DOMAINS) {
    const rootHost = root.split(':')[0];
    if (lower.endsWith(`.${rootHost}`)) {
      const sub = lower.slice(0, lower.length - rootHost.length - 1);
      if (sub === 'crm') return null;
      if (sub.endsWith('.crm')) return sub.slice(0, sub.length - '.crm'.length);
      return sub || null;
    }
  }

  const firstDot = lower.indexOf('.');
  if (firstDot < 0) return null;
  const label = lower.slice(0, firstDot);
  if (['www', 'crm', 'api', 'app'].includes(label)) return null;
  return label;
}

interface MembershipRow {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  domain: string | null;
  plan: string;
  branding: Record<string, unknown> | null;
  role: string;
  is_default: boolean;
}

/**
 * Resolve the active tenant for the current request.
 * Memoised per-request via React's `cache`. Returns null when no membership
 * can be resolved.
 */
export const getActiveTenant = cache(async (): Promise<ResolvedTenant | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const hdrs = await headers();
  const cookieStore = await cookies();

  const headerOrg = hdrs.get(ACTIVE_ORG_HEADER);
  const cookieOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const host = hdrs.get('host');
  const subdomain = extractSubdomain(host);

  const { data: memberships, error } = (await (supabase as any)
    .from('my_organizations')
    .select('id, name, slug, subdomain, domain, plan, branding, role, is_default')) as {
    data: MembershipRow[] | null;
    error: unknown;
  };

  if (error || !memberships || memberships.length === 0) return null;

  const byId = new Map<string, MembershipRow>(memberships.map((m) => [m.id, m]));
  const bySubdomain = new Map<string, MembershipRow>(
    memberships
      .filter((m): m is MembershipRow & { subdomain: string } => Boolean(m.subdomain))
      .map((m) => [m.subdomain, m]),
  );

  const candidates: (string | null | undefined)[] = [
    headerOrg,
    cookieOrg,
    subdomain ? bySubdomain.get(subdomain)?.id : undefined,
  ];

  const chosen: MembershipRow =
    candidates
      .map((id) => (id ? byId.get(id) : undefined))
      .find((m): m is MembershipRow => Boolean(m)) ??
    memberships.find((m) => m.is_default) ??
    memberships[0];

  return {
    organizationId: chosen.id,
    organizationSlug: chosen.slug,
    organizationName: chosen.name,
    subdomain: chosen.subdomain,
    domain: chosen.domain,
    role: chosen.role as TenantRole,
    isDefault: chosen.is_default,
    branding: (chosen.branding ?? {}) as Record<string, unknown>,
    plan: chosen.plan,
  };
});

/**
 * List every organization the current user belongs to (for the switcher UI).
 */
export async function listMyTenants(): Promise<TenantMembership[]> {
  const supabase = await createClient();
  const { data, error } = (await (supabase as any)
    .from('my_organizations')
    .select('id, name, slug, subdomain, domain, plan, branding, role, is_default')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })) as {
    data: MembershipRow[] | null;
    error: unknown;
  };

  if (error || !data) return [];

  return data.map((row) => ({
    organizationId: row.id,
    organizationName: row.name,
    organizationSlug: row.slug,
    subdomain: row.subdomain,
    domain: row.domain,
    role: row.role as TenantRole,
    isDefault: row.is_default,
    plan: row.plan,
    branding: (row.branding ?? {}) as Record<string, unknown>,
  }));
}

/**
 * Persist the active tenant choice in a cookie. Call from a server action.
 */
export async function setActiveTenantCookie(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
}
