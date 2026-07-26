import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/commissions
 * Get commission transactions for the current user/org
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const advisorId = searchParams.get('advisorId');
    const status = searchParams.get('status');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 500)
      : 50;

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
