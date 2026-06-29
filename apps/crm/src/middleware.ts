import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Cache profile data in a signed cookie to avoid DB query on every request
const PROFILE_CACHE_COOKIE = 'crm_profile_cache';
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

interface CachedProfile {
  id: string;
  crm_role: string | null;
  is_active: boolean;
  user_id: string;
  exp: number; // Expiration timestamp
}
// NOTE: organization_id is intentionally NOT cached. Tenant switching via
// `dh_active_org` cookie changes the effective org per request, but
// middleware-level routing decisions only need is_active + crm_role. Keeping
// org out of the cache means a switch never serves a stale tenant.

// ---------------------------------------------------------------------------
// HMAC signing helpers (Web Crypto API — Edge Runtime compatible)
// ---------------------------------------------------------------------------

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signPayload(payload: string): Promise<string> {
  const key = await getHmacKey();
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bufferToHex(signature);
}

async function verifyPayload(payload: string, signature: string): Promise<boolean> {
  const expectedSig = await signPayload(payload);
  if (expectedSig.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Profile cache helpers
// ---------------------------------------------------------------------------

async function getCachedProfile(request: NextRequest, userId: string): Promise<CachedProfile | null> {
  try {
    const raw = request.cookies.get(PROFILE_CACHE_COOKIE)?.value;
    if (!raw) return null;

    const dotIndex = raw.indexOf('.');
    if (dotIndex === -1) return null;

    const signature = raw.substring(0, dotIndex);
    const payload = raw.substring(dotIndex + 1);

    const valid = await verifyPayload(payload, signature);
    if (!valid) return null;

    const profile: CachedProfile = JSON.parse(payload);

    if (profile.exp < Date.now() || profile.user_id !== userId) {
      return null;
    }

    return profile;
  } catch {
    return null;
  }
}

async function setProfileCacheOnResponse(
  response: NextResponse,
  profile: { id: string; crm_role: string | null; is_active: boolean },
  userId: string
): Promise<void> {
  const cached: CachedProfile = {
    ...profile,
    user_id: userId,
    exp: Date.now() + PROFILE_CACHE_TTL,
  };

  const payload = JSON.stringify(cached);
  const signature = await signPayload(payload);

  response.cookies.set(PROFILE_CACHE_COOKIE, `${signature}.${payload}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PROFILE_CACHE_TTL / 1000,
    path: '/',
  });
}

function clearProfileCacheOnResponse(response: NextResponse): void {
  response.cookies.delete(PROFILE_CACHE_COOKIE);
}

/**
 * Create a redirect response that preserves Supabase auth cookies.
 *
 * When Supabase refreshes the JWT during `getUser()`, the new tokens are
 * written to `supabaseResponse` via the `setAll` callback. If we return a
 * plain `NextResponse.redirect()` instead, those cookies are lost and the
 * browser keeps sending the stale token — eventually causing silent auth
 * failures. This helper copies every cookie from `supabaseResponse` onto
 * the redirect so nothing is dropped.
 */
function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

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
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ── Public routes ────────────────────────────────────────────────────
  const publicPrefixes = [
    '/crm-login',
    '/crm-access-denied',
    '/login',
    '/reset-password',
    '/update-password',
    '/accept-invite',
  ];
  const isPublicRoute =
    pathname === '/' || publicPrefixes.some(prefix => pathname.startsWith(prefix));

  if (isPublicRoute) {
    const isLoginPage =
      pathname.startsWith('/crm-login') || pathname.startsWith('/login');

    // Authenticated user on a login page — redirect to CRM only if they
    // have a valid, active profile with a CRM role. Otherwise let them
    // stay so the login form can show the appropriate error.
    if (user && isLoginPage) {
      const profile = await resolveProfile(supabase, request, supabaseResponse, user.id);

      if (
        profile &&
        profile !== 'transient-error' &&
        profile.is_active &&
        profile.crm_role
      ) {
        const redirectParam = request.nextUrl.searchParams.get('redirect');
        const destination =
          redirectParam &&
          redirectParam.startsWith('/crm') &&
          !redirectParam.startsWith('//')
            ? redirectParam
            : '/crm';
        return redirectWithCookies(new URL(destination, request.url), supabaseResponse);
      }

      // Session exists but no usable CRM profile (or DB unreachable) —
      // stay on login page so the user can re-authenticate.
      return supabaseResponse;
    }

    return supabaseResponse;
  }

  // ── Protected routes — require authentication ────────────────────────
  if (!user) {
    const redirectUrl = new URL('/crm-login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    // No user means no Supabase token refresh happened, so a plain
    // redirect is fine here (no cookies to propagate).
    return NextResponse.redirect(redirectUrl);
  }

  // ── Resolve profile (cache → DB) ────────────────────────────────────
  const profile = await resolveProfile(supabase, request, supabaseResponse, user.id);

  if (profile === 'transient-error') {
    // DB unreachable — let the request through so page-level auth can
    // handle it gracefully. Supabase RLS still protects data.
    console.warn('[Middleware] Profile query failed (transient), allowing request through');
    return supabaseResponse;
  }

  if (!profile) {
    // No profile row at all — clear stale cache, redirect to login.
    const redirect = redirectWithCookies(new URL('/crm-login', request.url), supabaseResponse);
    clearProfileCacheOnResponse(redirect);
    return redirect;
  }

  if (!profile.is_active) {
    const redirect = redirectWithCookies(
      new URL('/crm-access-denied?reason=inactive', request.url),
      supabaseResponse,
    );
    clearProfileCacheOnResponse(redirect);
    return redirect;
  }

  if (pathname.startsWith('/crm') && !profile.crm_role) {
    const redirect = redirectWithCookies(
      new URL('/crm-access-denied', request.url),
      supabaseResponse,
    );
    return redirect;
  }

  return supabaseResponse;
}

// ---------------------------------------------------------------------------
// Profile resolution: cache → DB (with one retry for transient failures)
// ---------------------------------------------------------------------------

type ProfileResult = CachedProfile | null | 'transient-error';

async function resolveProfile(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
  supabaseResponse: NextResponse,
  userId: string,
): Promise<ProfileResult> {
  // 1. Try cache
  const cached = await getCachedProfile(request, userId);
  if (cached) return cached;

  // 2. Cache miss — query DB (retry once for transient failures)
  let dbProfile: { id: string; crm_role: string | null; organization_id: string; is_active: boolean } | null = null;
  let profileError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, crm_role, is_active')
      .eq('user_id', userId)
      .single();

    dbProfile = data;
    profileError = error;
    if (data || error?.code === 'PGRST116') break; // success or confirmed not-found
  }

  if (profileError && profileError.code !== 'PGRST116') {
    return 'transient-error';
  }

  if (!dbProfile) {
    return null;
  }

  // 3. Cache the profile for subsequent requests
  const cachedProfile: CachedProfile = {
    ...dbProfile,
    user_id: userId,
    exp: Date.now() + PROFILE_CACHE_TTL,
  };
  await setProfileCacheOnResponse(supabaseResponse, dbProfile, userId);

  return cachedProfile;
}

// ---------------------------------------------------------------------------
// Matcher — skip static assets, images, and API routes
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|css|map|webmanifest|woff|woff2|txt|xml)$).*)',
  ],
};
