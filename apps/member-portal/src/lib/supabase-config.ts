/**
 * Public server-rendered routes that cannot degrade without Supabase.
 *
 * Auth pages have their own configuration warning, but enrollment pages query
 * Supabase during Server Component rendering and would otherwise hard-500.
 */
export function missingSupabaseConfigRedirect(pathname: string): string | null {
  if (pathname === '/enroll' || pathname.startsWith('/enroll/')) {
    return '/access-denied?reason=config';
  }
  return null;
}
