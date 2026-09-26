import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  assertCommissionBatchOrgAccess,
  requireCrmOrgContext,
} from '@/lib/crm/require-crm-org';

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
    const orgCtx = await requireCrmOrgContext();
    if (!orgCtx.ok) {
      return NextResponse.json({ error: orgCtx.error }, { status: orgCtx.status });
    }

    const profile = orgCtx.profile;
    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { batchId } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!['pay', 'fail'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "pay" or "fail"' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // These payout RPCs are SECURITY DEFINER and take only p_batch_id, so they
    // do not scope themselves to an organization and RLS does not apply inside
    // them. Without this check any admin of any tenant could act on another
    // tenant's batch by supplying its id.
    const batchAccess = await assertCommissionBatchOrgAccess(supabase, batchId, orgCtx.orgId);
    if (!batchAccess.ok) {
      return NextResponse.json({ error: batchAccess.error }, { status: batchAccess.status });
    }

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
