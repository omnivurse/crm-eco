import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/payouts/[batchId]/approve
 *
 * Approves a payout batch. Compliance-enforced:
 *   - Separation of duties (creator cannot self-approve above threshold)
 *   - Hard cap check
 *   - Dual approval required for high-value batches (above dual_approve_threshold)
 *   - Runs anomaly detection before approval
 *
 * Dual approval flow:
 *   1. First admin approves → primary approval recorded, returns awaiting_secondary
 *   2. Second admin approves → secondary approval recorded, batch moves to processing
 *   Same admin cannot approve twice.
 *
 * Body:
 *   notes – optional approval notes
 *
 * Idempotent: re-approving an already-processing batch returns success.
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
    const body = await request.json().catch(() => ({}));
    const supabase = await createClient();

    // Run anomaly detection before approval
    const { data: anomalies, error: anomalyError } = await supabase.rpc(
      'detect_payout_anomalies',
      { p_batch_id: batchId }
    );

    if (anomalyError) {
      console.error('Anomaly detection error:', anomalyError);
      // Non-blocking: proceed with approval even if detection fails
    }

    // Approve batch (DB function enforces separation of duties + dual approval)
    const { data, error } = await supabase.rpc('approve_payout_batch', {
      p_batch_id: batchId,
      p_approved_by: profile.id,
      p_notes: body.notes || null,
    });

    if (error) throw error;

    // Check for RPC-level compliance blocks
    if (data?.error) {
      let status = 409;
      if (data.code === 'SELF_APPROVE_BLOCKED') status = 403;
      if (data.code === 'DUPLICATE_APPROVAL') status = 409;
      return NextResponse.json(
        { error: data.error, code: data.code },
        { status }
      );
    }

    return NextResponse.json({
      ...data,
      anomalies: anomalies?.flags_raised > 0 ? anomalies : null,
    });
  } catch (error) {
    console.error('Error approving payout batch:', error);
    return NextResponse.json({ error: 'Failed to approve payout batch' }, { status: 500 });
  }
}
