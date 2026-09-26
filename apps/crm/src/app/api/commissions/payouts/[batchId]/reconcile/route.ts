import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  assertCommissionBatchOrgAccess,
  requireCrmOrgContext,
} from '@/lib/crm/require-crm-org';
import { asPayoutRpcResult } from '@/lib/payouts/rpc-result';

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

    const { data, error } = await supabase.rpc('reconcile_payouts', {
      p_batch_id: batchId,
    });

    if (error) throw error;

    const result = asPayoutRpcResult(data);
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
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

    // This reads reconciliation logs under a service-role client filtered only
    // by batch_id, so RLS is not in play. Without this check the endpoint would
    // return another tenant's logs for any batch id.
    const batchAccess = await assertCommissionBatchOrgAccess(supabase, batchId, orgCtx.orgId);
    if (!batchAccess.ok) {
      return NextResponse.json({ error: batchAccess.error }, { status: batchAccess.status });
    }

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
