import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/signin',
    '/signup',
    '/reset-password',
    '/update-password',
    '/access-denied',
    '/enroll',
  ];

  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // API routes
  if (pathname.startsWith('/api/')) {
    return response;
  }

  // Static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // files with extensions
  ) {
    return response;
  }

  // If not authenticated and trying to access protected route
  if (!session && !isPublicRoute) {
    const redirectUrl = new URL('/signin', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated and trying to access auth routes
  if (session && (pathname === '/signin' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Agent portal protection
  if (pathname.startsWith('/agent') && session) {
    // Verify user is an agent by checking their profile role
    // This is a lightweight check - full verification happens in the layout
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', session.user.id)
      .single();

    if (!profile || profile.role !== 'advisor') {
      return NextResponse.redirect(new URL('/access-denied?reason=not_agent', request.url));
    }

    // Check if they have an active advisor record
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id, status')
      .eq('profile_id', profile.id)
      .single();

    if (!advisor) {
      return NextResponse.redirect(new URL('/access-denied?reason=not_agent', request.url));
    }

    if (advisor.status !== 'active') {
      return NextResponse.redirect(new URL('/access-denied?reason=agent_inactive', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
