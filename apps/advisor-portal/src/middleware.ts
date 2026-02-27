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

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Public routes
    const publicRoutes = ['/login', '/shared', '/reset-password', '/update-password'];
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        if (user && pathname === '/login') {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return supabaseResponse;
    }

    // Require authentication
    if (!user) {
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(redirectUrl);
    }

    // Check advisor role
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, advisor_role, advisor_id, organization_id')
        .eq('user_id', user.id)
        .single();

    if (!profile || !profile.advisor_role) {
        // No advisor access - redirect to login with error
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('error', 'no_advisor_access');
        return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
