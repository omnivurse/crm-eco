import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

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
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { batchId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('detect_payout_anomalies', {
      p_batch_id: batchId,
    });

    if (error) throw error;

    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error running anomaly detection:', error);
    return NextResponse.json({ error: 'Failed to run anomaly detection' }, { status: 500 });
  }
}
