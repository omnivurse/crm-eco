import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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
 * GET /api/commissions
 * Get commission transactions for the current user/org
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const advisorId = searchParams.get('advisorId');
    const status = searchParams.get('status');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('commission_transactions')
      .select(`
        *,
        advisors:advisor_id (id, first_name, last_name, email),
        source_advisor:source_advisor_id (id, first_name, last_name),
        enrollments:enrollment_id (id, enrollment_number),
        members:member_id (id, first_name, last_name)
      `)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by advisor if specified or if user is an advisor
    if (advisorId) {
      query = query.eq('advisor_id', advisorId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (periodStart) {
      query = query.gte('period_start', periodStart);
    }

    if (periodEnd) {
      query = query.lte('period_end', periodEnd);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Get commissions error:', error);
      return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
    }

    // Calculate summary
    const summary = {
      totalPending: 0,
      totalApproved: 0,
      totalPaid: 0,
      count: transactions?.length || 0,
    };

    if (transactions) {
      for (const tx of transactions) {
        if (tx.status === 'pending') summary.totalPending += Number(tx.commission_amount);
        if (tx.status === 'approved') summary.totalApproved += Number(tx.commission_amount);
        if (tx.status === 'paid') summary.totalPaid += Number(tx.commission_amount);
      }
    }

    return NextResponse.json({
      transactions,
      summary,
    });
  } catch (error) {
    console.error('Commissions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
