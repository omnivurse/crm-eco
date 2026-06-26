import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Admin Portal Middleware
 *
 * Edge-level enforcement. Runs BEFORE any page renders.
 *
 * Layered security model:
 *   1. Middleware (this file)        — Edge auth + tenant resolution
 *   2. Layout server component       — Profile + role re-verification
 *   3. lib/tenant.ts (server only)   — Active tenant resolver per request
 *   4. Postgres RLS                  — Final enforcement at the data layer
 */

const ADMIN_ROLES = ['owner', 'super_admin', 'admin', 'staff'];

const PUBLIC_ROUTES = ['/login', '/access-denied', '/reset-password', '/update-password'];
const AUTH_ONLY_ROUTES: string[] = [];

const ACTIVE_ORG_COOKIE = 'dh_active_org';
const ACTIVE_ORG_HEADER = 'x-active-org';
const RESOLVED_TENANT_HEADER = 'x-tenant-id';

/**
 * Extract the tenant subdomain candidate from a host header.
 * Returns null when host is the bare admin/root host or localhost.
 */
function extractSubdomain(host: string | null): string | null {
  if (!host) return null;
  const lower = host.toLowerCase().split(':')[0];

  // Keep in sync with ROOT_DOMAINS in src/lib/tenant.ts. Both lists include
  // the legacy doublehelixhub.com hosts so the PIFH production deploy keeps
  // resolving through `is_default` membership instead of being treated as a
  // subdomain tenant lookup that would no-op against an empty subdomain map.
  const roots = [
    'doublehelix.com',
    'admin.doublehelix.com',
    'doublehelixhub.com',
    'admin.doublehelixhub.com',
    'crm.doublehelixhub.com',
    'members.doublehelixhub.com',
    'localhost',
  ];
  if (roots.includes(lower)) return null;

  for (const root of roots) {
    if (lower.endsWith(`.${root}`)) {
      const sub = lower.slice(0, lower.length - root.length - 1);
      if (sub === 'admin') return null;
      if (sub.endsWith('.admin')) return sub.slice(0, sub.length - '.admin'.length);
      return sub || null;
    }
  }

  const firstDot = lower.indexOf('.');
  if (firstDot < 0) return null;
  const label = lower.slice(0, firstDot);
  if (['www', 'admin', 'api', 'app'].includes(label)) return null;
  return label;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;

  // PUBLIC enrollment surface (anon prospects — NO login). Matched EXACTLY so it
  // never opens up the auth-gated dashboard pages `/enrollments` or
  // `/enrollment-links` (a `startsWith('/enroll')` would). API routes (`/api/enroll/*`)
  // are already excluded from this middleware by the matcher below.
  const isEnrollRoute = pathname === '/enroll' || pathname.startsWith('/enroll/');

  // HOST HARDENING: a tenant enrollment host (`enroll.<tenant>`) must ONLY ever
  // serve the public enroll surface — never the admin dashboard, login, or
  // marketing landing. Anything else on such a host is redirected to /enroll, so
  // the dashboard is reachable only on the admin host(s).
  const reqHost = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  const isEnrollHost = reqHost.startsWith('enroll.');
  if (isEnrollHost && !isEnrollRoute) {
    return NextResponse.redirect(new URL('/enroll', request.url));
  }

  const isLandingPage = pathname === '/';
  const isPublicRoute =
    isLandingPage ||
    isEnrollRoute ||
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // ──────────────────────────────────────────────────────────────────
  //  Public routes (landing + auth + enroll)
  // ──────────────────────────────────────────────────────────────────
  if (isPublicRoute) {
    const { data: { user } } = await supabase.auth.getUser();

    if (user && (pathname === '/login' || pathname === '/')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('user_id', user.id)
        .single();

      if (profile && ADMIN_ROLES.includes(profile.role) && profile.is_active !== false) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    return supabaseResponse;
  }

  // ──────────────────────────────────────────────────────────────────
  //  Authenticated routes
  // ──────────────────────────────────────────────────────────────────
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (AUTH_ONLY_ROUTES.some((route) => pathname.startsWith(route))) {
    return supabaseResponse;
  }

  // ──────────────────────────────────────────────────────────────────
  //  Profile / role check
  // ──────────────────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_active, organization_id')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    const url = new URL('/access-denied', request.url);
    url.searchParams.set('reason', 'inactive');
    return NextResponse.redirect(url);
  }

  if (!ADMIN_ROLES.includes(profile.role)) {
    const url = new URL('/access-denied', request.url);
    url.searchParams.set('reason', 'role');
    return NextResponse.redirect(url);
  }

  // ──────────────────────────────────────────────────────────────────
  //  Tenant resolution (subdomain validation only at edge —
  //  the authoritative resolver lives in src/lib/tenant.ts)
  // ──────────────────────────────────────────────────────────────────
  const subdomain = extractSubdomain(request.headers.get('host'));
  const cookieOrg = request.cookies.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const headerOrg = request.headers.get(ACTIVE_ORG_HEADER);

  // If the host carries a tenant subdomain, verify the user belongs to that org.
  // We don't refuse access here on mismatch (the server-side resolver handles
  // the precise selection); we just expose the resolved tenant in a header for
  // downstream server components & request logging.
  if (subdomain) {
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .maybeSingle();

    if (orgRow) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', orgRow.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!membership) {
        const url = new URL('/access-denied', request.url);
        url.searchParams.set('reason', 'tenant');
        return NextResponse.redirect(url);
      }

      supabaseResponse.headers.set(RESOLVED_TENANT_HEADER, orgRow.id);
    }
  }

  // Pass the cookie / header tenant choice through unchanged
  if (headerOrg) supabaseResponse.headers.set(RESOLVED_TENANT_HEADER, headerOrg);
  else if (cookieOrg) supabaseResponse.headers.set(RESOLVED_TENANT_HEADER, cookieOrg);

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     *   - _next/static, _next/image
     *   - favicon, public folder assets
     *   - api routes (handle their own auth + tenancy)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
