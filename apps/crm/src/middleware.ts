import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
        setAll(cookiesToSet) {
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
      return NextResponse.redirect(new URL('/', request.url));
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

  // Check if user has a profile with CRM role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, crm_role, organization_id')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    // No profile found, redirect to login
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/crm-login', request.url));
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
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
