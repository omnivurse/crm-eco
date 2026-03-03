import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/score-config
 *
 * Returns the scoring configuration for the org.
 * Query params:
 *   capacity_scope – 'health_insurance' | 'health_share' | omit for default
 *
 * POST /api/analytics/score-config
 *
 * Upsert scoring configuration. Admin-only.
 * Body: { commission_weight, enrollment_weight, downline_weight, growth_weight,
 *         tier_bronze_max, tier_silver_max, tier_gold_max, tier_platinum_max,
 *         capacity_scope }
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const capacityScope = request.nextUrl.searchParams.get('capacity_scope') || null;

    const { data, error } = await supabase.rpc('get_score_config', {
      p_org_id: profile.organization_id,
      p_capacity_scope: capacityScope,
    });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching score config:', error);
    return NextResponse.json({ error: 'Failed to fetch score config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createClient();

    const capacityScope = body.capacity_scope || null;

    const { data, error } = await supabase
      .from('advisor_score_config')
      .upsert(
        {
          organization_id: profile.organization_id,
          capacity_scope: capacityScope,
          commission_weight: body.commission_weight ?? 1.0,
          enrollment_weight: body.enrollment_weight ?? 50.0,
          downline_weight: body.downline_weight ?? 0.3,
          growth_weight: body.growth_weight ?? 200.0,
          tier_bronze_max: body.tier_bronze_max ?? 500,
          tier_silver_max: body.tier_silver_max ?? 2000,
          tier_gold_max: body.tier_gold_max ?? 5000,
          tier_platinum_max: body.tier_platinum_max ?? 15000,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,capacity_scope' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving score config:', error);
    return NextResponse.json({ error: 'Failed to save score config' }, { status: 500 });
  }
}
