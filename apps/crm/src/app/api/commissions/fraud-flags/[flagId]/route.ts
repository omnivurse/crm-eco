import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/fraud-flags/[flagId]
 *
 * Resolve or dismiss a fraud flag.
 *
 * Body:
 *   status – 'resolved' | 'dismissed'
 *   notes  – optional resolution notes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { flagId } = await params;
    const body = await request.json();
    const { status, notes } = body;

    if (!['resolved', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be "resolved" or "dismissed"' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('resolve_fraud_flag', {
      p_flag_id: flagId,
      p_actor_id: profile.id,
      p_status: status,
      p_notes: notes || null,
    });

    if (error) throw error;

    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 409 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error resolving fraud flag:', error);
    return NextResponse.json({ error: 'Failed to resolve fraud flag' }, { status: 500 });
  }
}
