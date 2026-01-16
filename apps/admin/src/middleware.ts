import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Admin Portal Middleware
 * 
 * Provides hard edge-level enforcement of admin role requirements.
 * This runs BEFORE any page renders, preventing unauthorized access.
 * 
 * Security layers:
 * 1. Middleware (this file) - Edge-level check
 * 2. Layout server component - Server-side verification
 * 3. RLS policies - Database-level enforcement
 */

const ADMIN_ROLES = ['owner', 'admin', 'staff'];

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/access-denied'];

// Routes that require authentication but not admin role
const AUTH_ONLY_ROUTES: string[] = [];

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

  const pathname = request.nextUrl.pathname;

  // Check if this is a public route
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    // If user is already authenticated, check if they should be redirected
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user && pathname === '/login') {
      // Check if user has admin access before redirecting to dashboard
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

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // If no user, redirect to login
  if (!user || userError) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check if this is an auth-only route (doesn't need admin role)
  if (AUTH_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    return supabaseResponse;
  }

  // For all other routes, verify admin role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_active, organization_id')
    .eq('user_id', user.id)
    .single();

  // No profile found - user needs to complete setup or doesn't have access
  if (profileError || !profile) {
    // Sign out and redirect to login
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check if account is active
  if (profile.is_active === false) {
    await supabase.auth.signOut();
    const accessDeniedUrl = new URL('/access-denied', request.url);
    accessDeniedUrl.searchParams.set('reason', 'inactive');
    return NextResponse.redirect(accessDeniedUrl);
  }

  // Check if user has admin role
  if (!ADMIN_ROLES.includes(profile.role)) {
    const accessDeniedUrl = new URL('/access-denied', request.url);
    accessDeniedUrl.searchParams.set('reason', 'role');
    return NextResponse.redirect(accessDeniedUrl);
  }

  // User is authenticated and has admin role - allow access
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
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
