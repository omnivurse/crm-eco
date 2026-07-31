import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  MFA_STEP_UP_PATH,
  hasVerifiedTotpFactor,
  isMfaEnforcementEnabled,
  isMfaStepUpRequired,
  readAalFromAccessToken,
} from '@/lib/security/mfa';

// Cache profile data in a signed cookie to avoid DB query on every request
const PROFILE_CACHE_COOKIE = 'crm_profile_cache';
// 60s, not 5min: this cache is how long a revoked role or a deactivated account
// can still pass the *routing* check. Data access is unaffected — RLS derives
// permissions from live tables keyed by auth.uid(), so a revoked role stops
// returning rows immediately. Shortening the window bounds the residual
// routing-decision lag to a minute without forcing a DB read per request.
const PROFILE_CACHE_TTL = 60 * 1000;

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

// The profile-cache cookie is HMAC-signed with the service-role key. If that
// secret is missing/empty (a misconfigured environment), Web Crypto's
// importKey throws "Zero-length key is not supported" — and because this runs
// in middleware, that would take down EVERY matched route. Treat an absent
// secret as "caching disabled": skip the signed cache and fall back to the DB
// lookup (warning once) instead of crashing the whole app. When the key IS
// present (e.g. production), behavior is unchanged.
const HMAC_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const HMAC_AVAILABLE = HMAC_SECRET.length > 0;

let warnedMissingSecret = false;
function warnMissingSecretOnce(): void {
  if (warnedMissingSecret) return;
  warnedMissingSecret = true;
  console.warn(
    '[Middleware] SUPABASE_SERVICE_ROLE_KEY is not set — profile-cache signing ' +
      'disabled; falling back to a DB profile lookup on every request. Set the ' +
      'key to re-enable the signed cache.',
  );
}

async function getHmacKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SECRET),
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
  if (!HMAC_AVAILABLE) return null; // no signing secret — force a fresh DB lookup
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
  if (!HMAC_AVAILABLE) {
    warnMissingSecretOnce();
    return; // no signing secret — skip the signed cache; the DB lookup already ran
  }
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail closed for protected routes when env is missing — never throw from
  // createServerClient (that surfaces as a hard 500 on every navigation).
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[Middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
        'Add them to apps/crm/.env.local (see .env.example).',
    );
    const pathname = request.nextUrl.pathname;
    const publicPrefixes = [
      '/crm-login',
      '/crm-access-denied',
      '/login',
      '/reset-password',
      '/update-password',
      '/accept-invite',
    ];
    const isPublicRoute =
      pathname === '/' || publicPrefixes.some((prefix) => pathname.startsWith(prefix));
    if (isPublicRoute) {
      return supabaseResponse;
    }
    return NextResponse.redirect(new URL('/crm-login?error=config', request.url));
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
    // The MFA step-up screen lives under /crm-login so it stays reachable
    // without a fully-assured session, but it must NOT behave like a login
    // page: bouncing an authenticated AAL1 user from it to /crm would
    // ping-pong forever against the step-up redirect below.
    const isStepUpPage = pathname === MFA_STEP_UP_PATH;
    const isLoginPage =
      !isStepUpPage &&
      (pathname.startsWith('/crm-login') || pathname.startsWith('/login'));

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

  // ── Continuous MFA verification (step-up) ────────────────────────────
  // Supabase issues an AAL1 session after a password sign-in even when the user
  // holds a verified TOTP factor, so enforcing the challenge only in the login
  // UI is not enforcement at all — a client can navigate straight past it.
  // Re-check the assurance level here, on every protected request.
  //
  // The factor check runs first because it is free (already on `user`), and it
  // keeps the extra session read off the path of users without MFA enrolled.
  if (isMfaEnforcementEnabled() && hasVerifiedTotpFactor(user.factors)) {
    // getSession() reads the cookie without re-validating it, which is safe
    // here: getUser() above already authenticated this request against the auth
    // server, and we only read the `aal` claim out of that same verified token.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (
      isMfaStepUpRequired({
        enforced: true,
        hasVerifiedFactor: true,
        aal: readAalFromAccessToken(session?.access_token),
      })
    ) {
      const stepUpUrl = new URL(MFA_STEP_UP_PATH, request.url);
      stepUpUrl.searchParams.set('redirect', pathname);
      return redirectWithCookies(stepUpUrl, supabaseResponse);
    }
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
