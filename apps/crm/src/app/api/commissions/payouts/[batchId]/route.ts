import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/payouts/[batchId]
 *
 * Process a payout batch: mark as paid or failed.
 *
 * Body:
 *   action – 'pay' | 'fail'
 *   reason – required when action is 'fail'
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
    const body = await request.json();
    const { action, reason } = body;

    if (!['pay', 'fail'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "pay" or "fail"' }, { status: 400 });
    }

    const supabase = await createClient();

    if (action === 'pay') {
      const { data, error } = await supabase.rpc('mark_payout_paid', {
        p_batch_id: batchId,
        p_processed_by: profile.id,
      });
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase.rpc('mark_payout_failed', {
        p_batch_id: batchId,
        p_reason: reason || 'Payment processing failed',
      });
      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error processing payout batch:', error);
    return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 });
  }
}
