import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/achievements/[id]/ack
 *
 * Acknowledge (dismiss) an achievement notification.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('advisor_achievements')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ acknowledged: true });
  } catch (error) {
    console.error('Error acknowledging achievement:', error);
    return NextResponse.json({ error: 'Failed to acknowledge achievement' }, { status: 500 });
  }
}
