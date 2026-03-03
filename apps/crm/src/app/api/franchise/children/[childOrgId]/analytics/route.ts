import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/franchise/children/[childOrgId]/analytics
 *
 * Returns aggregated analytics for a specific child org.
 * Requires active delegation with view_aggregated_analytics permission.
 * Never exposes raw records.
 *
 * Query params:
 *   months – lookback months (default 12)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childOrgId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { childOrgId } = await params;
    const supabase = await createClient();
    const months = Math.min(Number(request.nextUrl.searchParams.get('months') || '12'), 36);

    const { data, error } = await supabase.rpc('get_franchise_child_analytics', {
      p_parent_org_id: profile.organization_id,
      p_child_org_id: childOrgId,
      p_months: months,
    });

    if (error) {
      if (error.message?.includes('NO_DELEGATION')) {
        return NextResponse.json({ error: 'No active delegation for this child org' }, { status: 403 });
      }
      if (error.message?.includes('ACCESS_DENIED')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching child org analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch child org analytics' }, { status: 500 });
  }
}
