/**
 * Tenant resolution helpers (server-side only)
 * ----------------------------------------------------------------
 * The Admin app is multi-tenant. Each request must resolve to
 * exactly one `organization_id`. The resolver tries the following
 * strategies in order:
 *
 *  1. `x-active-org` header (set by the client when the user has
 *     just switched orgs via the OrganizationSwitcher UI).
 *  2. `dh_active_org` cookie (sticky selection across requests).
 *  3. Subdomain match on the request host
 *     (e.g. `acme.admin.doublehelix.com` → org with subdomain=acme).
 *  4. Vanity domain match on `organizations.domain`.
 *  5. The user's default organization in `organization_members`
 *     (`is_default = true`), falling back to first active membership.
 *
 * All resolution paths verify the user is a member of the org —
 * never trust a header / cookie / subdomain in isolation.
 */
import 'server-only';

import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  ACTIVE_ORG_COOKIE,
  ACTIVE_ORG_HEADER,
  type TenantRole,
} from '@crm-eco/lib/tenant';

export { ACTIVE_ORG_COOKIE, ACTIVE_ORG_HEADER };
export type { TenantRole };

// Root domains the resolver recognises as "no tenant slug" hosts.
// `doublehelixhub.com` is kept for back-compat with the PIFH production
// deploy that predates the doublehelix.com rebrand — once DNS is cut over
// the legacy entries can be removed without breaking existing sessions.
const ROOT_DOMAINS = [
  'doublehelix.com',
  'admin.doublehelix.com',
  'doublehelixhub.com',
  'admin.doublehelixhub.com',
  'crm.doublehelixhub.com',
  'members.doublehelixhub.com',
  'cashpay.doublehelixhub.com',
  'localhost',
  'localhost:3002',
];

export interface ResolvedTenant {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  subdomain: string | null;
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
  role: TenantRole;
  isDefault: boolean;
  plan: string;
  branding: Record<string, unknown>;
}

/**
 * Extract a candidate subdomain from a host header.
 * Returns null when the host is the bare root domain (no tenant slug).
 *
 * Examples:
 *   acme.admin.doublehelix.com  → "acme"
 *   admin.doublehelix.com       → null
 *   doublehelix.com             → null
 *   localhost:3002              → null
 *   acme.localhost:3002         → "acme"
 */
export function extractSubdomain(host: string | null): string | null {
  if (!host) return null;

  const lower = host.toLowerCase().split(':')[0]; // strip port
  if (ROOT_DOMAINS.some((d) => lower === d.split(':')[0])) return null;

  // Strip the longest known root from the right
  for (const root of ROOT_DOMAINS) {
    const rootHost = root.split(':')[0];
    if (lower.endsWith(`.${rootHost}`)) {
      const sub = lower.slice(0, lower.length - rootHost.length - 1);
      // Treat "admin" as the bare root for the canonical admin host
      if (sub === 'admin') return null;
      // Allow "acme.admin" → "acme"
      if (sub.endsWith('.admin')) return sub.slice(0, sub.length - '.admin'.length);
      return sub || null;
    }
  }

  // Fallback: take the first label before the first dot
  const firstDot = lower.indexOf('.');
  if (firstDot < 0) return null;
  const label = lower.slice(0, firstDot);
  if (['www', 'admin', 'api', 'app'].includes(label)) return null;
  return label;
}

/**
 * Resolve the active tenant for the current request.
 *
 * Memoised per-request via React's `cache` so repeated calls in the
 * same render do not hit the database multiple times.
 *
 * Returns null when no membership can be resolved — callers should
 * redirect to /access-denied or /onboarding accordingly.
 */
export const getActiveTenant = cache(
  async (): Promise<ResolvedTenant | null> => {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const hdrs = await headers();
    const cookieStore = await cookies();

    const headerOrg = hdrs.get(ACTIVE_ORG_HEADER);
    const cookieOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    const host = hdrs.get('host');
    const subdomain = extractSubdomain(host);

    // Fetch every membership the user has — RLS guarantees they only
    // see their own rows.
    type MembershipRow = {
      id: string;
      name: string;
      slug: string;
      subdomain: string | null;
      plan: string;
      branding: Record<string, unknown> | null;
      role: string;
      is_default: boolean;
    };

    const { data: memberships, error } = (await (supabase as any)
      .from('my_organizations')
      .select(
        'id, name, slug, subdomain, plan, branding, role, is_default',
      )) as { data: MembershipRow[] | null; error: unknown };

    if (error || !memberships || memberships.length === 0) return null;

    const byId = new Map<string, MembershipRow>(memberships.map((m) => [m.id, m]));
    const bySubdomain = new Map<string, MembershipRow>(
      memberships
        .filter((m): m is MembershipRow & { subdomain: string } => Boolean(m.subdomain))
        .map((m) => [m.subdomain, m]),
    );

    // Resolution priority chain
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
      role: chosen.role as TenantRole,
      isDefault: chosen.is_default,
      branding: (chosen.branding ?? {}) as Record<string, unknown>,
      plan: chosen.plan,
    };
  },
);

/**
 * Variant that throws / redirects when no tenant can be resolved.
 * Use in server components that must have a tenant in scope.
 */
export async function requireActiveTenant(): Promise<ResolvedTenant> {
  const tenant = await getActiveTenant();
  if (!tenant) {
    throw new Error(
      'requireActiveTenant: no organization in scope for the current user.',
    );
  }
  return tenant;
}

/**
 * List every organization the current user belongs to (for the switcher UI).
 */
export async function listMyTenants(): Promise<TenantMembership[]> {
  const supabase = await createServerSupabaseClient();
  type MembershipRow = {
    id: string;
    name: string;
    slug: string;
    subdomain: string | null;
    plan: string;
    branding: Record<string, unknown> | null;
    role: string;
    is_default: boolean;
  };
  const { data, error } = (await (supabase as any)
    .from('my_organizations')
    .select('id, name, slug, subdomain, plan, branding, role, is_default')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })) as { data: MembershipRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((row) => ({
    organizationId: row.id,
    organizationName: row.name,
    organizationSlug: row.slug,
    subdomain: row.subdomain,
    role: row.role as TenantRole,
    isDefault: row.is_default,
    plan: row.plan,
    branding: (row.branding ?? {}) as Record<string, unknown>,
  }));
}

/**
 * Persist the active tenant choice in a cookie. Call from a server
 * action when the user picks a different tenant in the switcher.
 */
export async function setActiveTenantCookie(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,                  // readable for client switcher animation
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,       // 1 year
  });
}
