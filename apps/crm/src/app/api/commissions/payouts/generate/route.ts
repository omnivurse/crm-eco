import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/payouts/generate
 *
 * Creates a payout batch from available ledger entries using the
 * create_payout_batch() database function.
 *
 * Body:
 *   periodStart – start date (defaults to first of last month)
 *   periodEnd   – end date (defaults to last of last month)
 *   description – optional batch description
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    // Default to last month if not provided
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const periodStart = body.periodStart || lastMonthStart.toISOString().split('T')[0];
    const periodEnd = body.periodEnd || lastMonthEnd.toISOString().split('T')[0];

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('create_payout_batch', {
      p_org_id: profile.organization_id,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_description: body.description || null,
    });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error generating payout batch:', error);
    return NextResponse.json({ error: 'Failed to generate payout batch' }, { status: 500 });
  }
}
