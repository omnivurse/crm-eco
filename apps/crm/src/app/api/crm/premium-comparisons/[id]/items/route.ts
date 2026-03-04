import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/premium-comparisons/[id]/items
 * Fetch all items for a comparison (with net_premium computed column)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Verify comparison belongs to org
    const { data: comparison } = await supabase
      .from('premium_comparisons')
      .select('id, comparison_name, record_id, notes, created_at')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!comparison) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 });
    }

    const { data: items, error } = await supabase
      .from('premium_comparison_items')
      .select('*')
      .eq('comparison_id', id)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[ComparisonItems GET]', error);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    return NextResponse.json({
      comparison,
      items: items || [],
    });
  } catch (error) {
    console.error('[ComparisonItems GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
