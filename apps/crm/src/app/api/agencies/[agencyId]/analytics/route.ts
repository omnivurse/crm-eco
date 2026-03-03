import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agencies/[agencyId]/analytics
 *
 * Returns agency-scoped analytics using mv_advisor_monthly_performance.
 * Uses get_agency_scoped_analytics() RPC which filters to agency members only.
 *
 * Query params:
 *   months         – lookback months (default 12)
 *   capacity_scope – 'health_insurance' | 'health_share' | omit for all
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agencyId } = await params;
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const months = Math.min(Number(searchParams.get('months') || '12'), 36);
    const capacityScope = searchParams.get('capacity_scope') || null;

    const { data, error } = await supabase.rpc('get_agency_scoped_analytics', {
      p_agency_id: agencyId,
      p_months: months,
      p_capacity_scope: capacityScope,
    });

    if (error) throw error;

    return NextResponse.json(data || {
      agency_id: agencyId,
      summary: {},
      by_product: [],
      top_advisors: [],
      monthly: [],
    });
  } catch (error) {
    console.error('Error fetching agency analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch agency analytics' }, { status: 500 });
  }
}
