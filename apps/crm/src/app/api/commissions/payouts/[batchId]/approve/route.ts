import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/payouts/[batchId]/approve
 *
 * Moves a payout batch from draft → processing.
 * Compliance-enforced:
 *   - Separation of duties (creator cannot self-approve above threshold)
 *   - Hard cap check
 *   - Runs anomaly detection before approval
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

    // Approve batch (DB function enforces separation of duties + thresholds)
    const { data, error } = await supabase.rpc('approve_payout_batch', {
      p_batch_id: batchId,
      p_approved_by: profile.id,
    });

    if (error) throw error;

    // Check for RPC-level compliance blocks
    if (data?.error) {
      const status = data.code === 'SELF_APPROVE_BLOCKED' ? 403 : 409;
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
