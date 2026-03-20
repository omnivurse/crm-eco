import { NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/dashboard
 * Returns comprehensive CRM dashboard stats via reporting RPCs
 */
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Fetch all reporting data in parallel
    const [statsResult, advisorResult, carrierResult, ageResult, statusResult] =
      await Promise.all([
        supabase.rpc('get_crm_dashboard_stats', {
          p_org_id: profile.organization_id,
        }),
        supabase.rpc('get_members_by_advisor', {
          p_org_id: profile.organization_id,
          p_limit: 15,
        }),
        supabase.rpc('get_members_by_carrier', {
          p_org_id: profile.organization_id,
          p_limit: 15,
        }),
        supabase.rpc('get_members_by_age_range', {
          p_org_id: profile.organization_id,
        }),
        supabase.rpc('get_members_by_status', {
          p_org_id: profile.organization_id,
        }),
      ]);

    return NextResponse.json({
      stats: statsResult.data || {},
      byAdvisor: advisorResult.data || [],
      byCarrier: carrierResult.data || [],
      byAgeRange: ageResult.data || [],
      byStatus: statusResult.data || [],
    });
  } catch (error) {
    console.error('[Dashboard API]', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 },
    );
  }
}
