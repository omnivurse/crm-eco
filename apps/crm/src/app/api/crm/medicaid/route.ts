import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/medicaid
 * Fetch Medicaid dashboard stats and optional state breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const includeStates = searchParams.get('include_states') === 'true';

    // Org-level stats
    const { data: stats, error: statsError } = await supabase
      .from('medicaid_dashboard_stats')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single();

    if (statsError && statsError.code !== 'PGRST116') {
      console.error('[Medicaid GET stats]', statsError);
    }

    const result: Record<string, unknown> = {
      stats: stats || {
        total_medicaid_members: 0,
        active_medicaid: 0,
        former_medicaid: 0,
        transitioning_from_medicaid: 0,
        new_medicaid_this_month: 0,
      },
    };

    // Per-state breakdown
    if (includeStates) {
      const { data: stateData, error: stateError } = await supabase
        .from('medicaid_state_breakdown')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('total', { ascending: false });

      if (stateError) {
        console.error('[Medicaid GET states]', stateError);
      }

      result.states = stateData || [];
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Medicaid GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
