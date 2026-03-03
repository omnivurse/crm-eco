import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/commissions/payouts/[batchId]/logs
 *
 * Returns the audit log for a specific payout batch.
 * Admin-only.
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
      .from('payout_batch_logs')
      .select('id, action, actor_id, actor_type, prev_status, new_status, details, created_at')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ logs: data || [] });
  } catch (error) {
    console.error('Error fetching batch logs:', error);
    return NextResponse.json({ error: 'Failed to fetch batch logs' }, { status: 500 });
  }
}
