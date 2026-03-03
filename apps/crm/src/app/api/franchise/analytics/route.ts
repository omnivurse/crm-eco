import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/franchise/analytics
 *
 * Returns aggregated analytics across ALL child orgs.
 * Uses get_franchise_analytics() which respects delegation permissions.
 * Only returns data for children with active analytics delegation.
 *
 * Query params:
 *   months – lookback months (default 12)
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();
    const months = Math.min(Number(request.nextUrl.searchParams.get('months') || '12'), 36);

    const { data, error } = await supabase.rpc('get_franchise_analytics', {
      p_parent_org_id: profile.organization_id,
      p_months: months,
    });

    if (error) {
      if (error.message?.includes('ACCESS_DENIED')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      throw error;
    }

    return NextResponse.json(data || {
      parent_org_id: profile.organization_id,
      summary: {},
      by_child_org: [],
      by_product: [],
      monthly: [],
    });
  } catch (error) {
    console.error('Error fetching franchise analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch franchise analytics' }, { status: 500 });
  }
}
