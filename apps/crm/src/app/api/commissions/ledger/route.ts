import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/commissions/ledger
 *
 * Returns commission ledger entries for the current user/organization.
 * Admins see all entries; advisors see only their own.
 *
 * Query params:
 *   status   – filter by ledger status (available, scheduled, paid, reversed, held)
 *   limit    – max entries (default 100)
 *   offset   – pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const params = request.nextUrl.searchParams;
    const status = params.get('status');
    const limit = Math.min(Number(params.get('limit') || '100'), 500);
    const offset = Number(params.get('offset') || '0');

    const isAdmin = ['owner', 'super_admin', 'admin'].includes(profile.role || '');

    let query = supabase
      .from('commission_ledger')
      .select(`
        id, advisor_id, commission_id, amount, product_type, status,
        payout_batch_id, payout_id, reversed_at, reversed_reason,
        created_at, updated_at,
        advisors:advisor_id ( id, first_name, last_name, email )
      `)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    // Non-admins only see their own
    if (!isAdmin) {
      const { data: advisor } = await supabase
        .from('advisors')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('organization_id', profile.organization_id)
        .single();

      if (advisor) {
        query = query.eq('advisor_id', advisor.id);
      } else {
        return NextResponse.json({ entries: [], summary: {} });
      }
    }

    const { data: entries, error } = await query;
    if (error) throw error;

    // Summary counts
    const { data: summaryData } = await supabase
      .from('commission_ledger')
      .select('status, amount')
      .eq('organization_id', profile.organization_id);

    const summary = {
      available: 0,
      scheduled: 0,
      paid: 0,
      reversed: 0,
      held: 0,
      total_available_amount: 0,
    };

    for (const row of summaryData || []) {
      const s = row.status as keyof typeof summary;
      if (s in summary && typeof summary[s] === 'number') {
        (summary as Record<string, number>)[s] += 1;
      }
      if (row.status === 'available') {
        summary.total_available_amount += Number(row.amount) || 0;
      }
    }

    return NextResponse.json({ entries: entries || [], summary });
  } catch (error) {
    console.error('Error fetching commission ledger:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }
}
