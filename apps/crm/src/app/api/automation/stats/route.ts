import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAutomationStats } from '@/lib/automation';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

/**
 * GET /api/automation/stats
 * Get automation statistics for the current organization
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.crm_role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await getAutomationStats(profile.organization_id);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Get automation stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
