import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  assertCommissionBatchOrgAccess,
  requireCrmOrgContext,
} from '@/lib/crm/require-crm-org';
import { asPayoutRpcResult } from '@/lib/payouts/rpc-result';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/payouts/[batchId]/anomalies
 *
 * Runs anomaly detection on a payout batch.
 * Returns spike flags, threshold breaches, duplicate bank accounts.
 * Admin-only.
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
    const supabase = createServiceRoleClient();

    // These payout RPCs are SECURITY DEFINER and take only p_batch_id, so they
    // do not scope themselves to an organization and RLS does not apply inside
    // them. Without this check any admin of any tenant could act on another
    // tenant's batch by supplying its id.
    const batchAccess = await assertCommissionBatchOrgAccess(supabase, batchId, orgCtx.orgId);
    if (!batchAccess.ok) {
      return NextResponse.json({ error: batchAccess.error }, { status: batchAccess.status });
    }

    const { data, error } = await supabase.rpc('detect_payout_anomalies', {
      p_batch_id: batchId,
    });

    if (error) throw error;

    const result = asPayoutRpcResult(data);
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error running anomaly detection:', error);
    return NextResponse.json({ error: 'Failed to run anomaly detection' }, { status: 500 });
  }
}
