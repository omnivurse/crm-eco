import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/sequences/[id]/analytics
 *
 * Aggregation happens in public.sequence_analytics rather than here: the
 * engagement tables are admin-only, and pulling a row per sent email back
 * into Node to count it would not survive a real sequence.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.rpc('sequence_analytics', {
      p_sequence_id: id,
    });

    if (error) {
      // The function raises 42501 when the caller's org does not own the
      // sequence. Surface that as a 403 rather than a generic failure.
      if (error.code === '42501') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    return NextResponse.json({ analytics: data });
  } catch (error) {
    console.error('Error fetching sequence analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
