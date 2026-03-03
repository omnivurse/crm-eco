import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/payouts/[batchId]/reconcile
 *
 * Runs reconciliation for a payout batch.
 * Compares expected payout amounts/statuses against provider transaction records.
 * Flags discrepancies for manual review.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { batchId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('reconcile_payouts', {
      p_batch_id: batchId,
    });

    if (error) throw error;

    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reconciling payout batch:', error);
    return NextResponse.json(
      { error: 'Failed to reconcile payout batch' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/commissions/payouts/[batchId]/reconcile
 *
 * Returns existing reconciliation logs for a batch.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { batchId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('payout_reconciliation_logs')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const summary = {
      total: data?.length || 0,
      matched: data?.filter((r) => !r.discrepancy_flag).length || 0,
      discrepancies: data?.filter((r) => r.discrepancy_flag).length || 0,
      unresolved: data?.filter((r) => r.discrepancy_flag && !r.resolved).length || 0,
    };

    return NextResponse.json({ summary, logs: data });
  } catch (error) {
    console.error('Error fetching reconciliation logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation logs' },
      { status: 500 }
    );
  }
}
