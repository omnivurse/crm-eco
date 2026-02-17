import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Cache profile data in a cookie for 5 minutes to avoid DB query on every request
const PROFILE_CACHE_COOKIE = 'crm_profile_cache';
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

interface CachedProfile {
  id: string;
  crm_role: string | null;
  organization_id: string;
  user_id: string;
  exp: number; // Expiration timestamp
}

function getCachedProfile(request: NextRequest, userId: string): CachedProfile | null {
  try {
    const cached = request.cookies.get(PROFILE_CACHE_COOKIE)?.value;
    if (!cached) return null;

    const profile: CachedProfile = JSON.parse(cached);

    // Validate cache: check expiration and user match
    if (profile.exp < Date.now() || profile.user_id !== userId) {
      return null;
    }

    return profile;
  } catch {
    return null;
  }
}

function setCachedProfile(
  response: NextResponse,
  profile: { id: string; crm_role: string | null; organization_id: string },
  userId: string
): void {
  const cached: CachedProfile = {
    ...profile,
    user_id: userId,
    exp: Date.now() + PROFILE_CACHE_TTL,
  };

  response.cookies.set(PROFILE_CACHE_COOKIE, JSON.stringify(cached), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PROFILE_CACHE_TTL / 1000, // Convert to seconds
    path: '/',
  });
}

function clearProfileCache(response: NextResponse): void {
  response.cookies.delete(PROFILE_CACHE_COOKIE);
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes - no auth required
  const publicRoutes = ['/crm-login', '/crm-access-denied', '/login'];
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    // If user is already authenticated, redirect to dashboard
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return supabaseResponse;
  }

  // Protected routes - require authentication
  if (!user) {
    // Redirect to CRM login
    const redirectUrl = new URL('/crm-login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // For CRM routes, verify the user has CRM access
  // This is done by checking if they have a crm_role in their profile
  // Note: We rely on client-side check for detailed role verification
  // The database RLS policies will enforce actual access control

  // Try to get profile from cache first (avoids DB query on every request)
  let profile = getCachedProfile(request, user.id);

  if (!profile) {
    // Cache miss - fetch from database
    const { data: dbProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !dbProfile) {
      // No profile found, clear cache and redirect to login
      clearProfileCache(supabaseResponse);
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/crm-login', request.url));
    }

    // Cache the profile for subsequent requests
    profile = { ...dbProfile, user_id: user.id, exp: Date.now() + PROFILE_CACHE_TTL };
    setCachedProfile(supabaseResponse, dbProfile, user.id);
  }

  // Check if user has CRM access for /crm/* routes
  if (pathname.startsWith('/crm') && !profile.crm_role) {
    // User doesn't have CRM access - redirect to access denied page
    return NextResponse.redirect(new URL('/crm-access-denied', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     * - api routes (they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|css|map|webmanifest|woff|woff2|txt|xml)$).*)',
  ],
};
