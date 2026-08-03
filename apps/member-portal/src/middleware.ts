import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

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

  // IMPORTANT: Use getUser() instead of getSession() for proper JWT validation.
  // getSession() only reads from cookies and does NOT validate the JWT server-side.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/signin',
    '/signup',
    '/login',
    '/reset-password',
    '/update-password',
    '/access-denied',
    '/enroll',
    '/legal',
  ];

  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // API routes
  if (pathname.startsWith('/api/')) {
    return supabaseResponse;
  }

  // Static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // files with extensions
  ) {
    return supabaseResponse;
  }

  // If not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL('/signin', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated and trying to access auth routes
  if (user && (pathname === '/signin' || pathname === '/signup' || pathname === '/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Agent portal protection
  if (pathname.startsWith('/agent') && user) {
    // Verify user is an agent by checking their profile role
    // This is a lightweight check - full verification happens in the layout
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single() as { data: { id: string; role: string } | null };

    if (!profile) {
      return NextResponse.redirect(new URL('/access-denied?reason=not_agent', request.url));
    }

    // Owners and admins bypass advisor checks — they have full access
    const bypassRoles = ['owner', 'super_admin', 'admin'];
    if (!bypassRoles.includes(profile.role)) {
      if (profile.role !== 'advisor') {
        return NextResponse.redirect(new URL('/access-denied?reason=not_agent', request.url));
      }

      // Check if they have an active advisor record
      const { data: advisor } = await supabase
        .from('advisors')
        .select('id, status')
        .eq('profile_id', profile.id)
        .single() as { data: { id: string; status: string } | null };

      if (!advisor) {
        return NextResponse.redirect(new URL('/access-denied?reason=not_agent', request.url));
      }

      if (advisor.status !== 'active') {
        return NextResponse.redirect(new URL('/access-denied?reason=agent_inactive', request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     * - .well-known/workflow/ (Workflow DevKit internal paths — must NOT be
     *   intercepted or durable-workflow resumption breaks on Next 16)
     */
    '/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
