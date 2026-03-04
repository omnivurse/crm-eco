import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/carriers/search
 * Search plans by location (state + optional rating area)
 * Returns carriers with their available plans for that location
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const ratingArea = searchParams.get('rating_area');
    const planType = searchParams.get('plan_type');
    const metalLevel = searchParams.get('metal_level');
    const maxPremium = searchParams.get('max_premium');

    if (!state) {
      return NextResponse.json({ error: 'state is required' }, { status: 400 });
    }

    // Step 1: Find carriers available in this state
    let availQuery = supabase
      .from('carrier_state_availability')
      .select('carrier_id')
      .eq('organization_id', profile.organization_id)
      .eq('state', state.toUpperCase())
      .eq('is_active', true);

    if (ratingArea) {
      availQuery = availQuery.eq('rating_area', ratingArea);
    }

    const { data: availability } = await availQuery;
    const carrierIds = [...new Set((availability || []).map((a) => a.carrier_id))];

    if (carrierIds.length === 0) {
      return NextResponse.json({ data: [], carriers: [] });
    }

    // Step 2: Fetch those carriers
    const { data: carriers } = await supabase
      .from('insurance_carriers')
      .select('id, carrier_name, carrier_type, logo_url, naic_code, website')
      .in('id', carrierIds)
      .eq('is_active', true)
      .order('carrier_name', { ascending: true });

    // Step 3: Fetch plans from those carriers
    let planQuery = supabase
      .from('insurance_plans')
      .select('*')
      .in('carrier_id', carrierIds)
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('base_premium', { ascending: true });

    if (planType) {
      planQuery = planQuery.eq('plan_type', planType);
    }
    if (metalLevel) {
      planQuery = planQuery.eq('metal_level', metalLevel);
    }
    if (maxPremium) {
      planQuery = planQuery.lte('base_premium', parseFloat(maxPremium));
    }

    const { data: plans } = await planQuery;

    return NextResponse.json({
      carriers: carriers || [],
      data: plans || [],
      state: state.toUpperCase(),
      rating_area: ratingArea,
    });
  } catch (error) {
    console.error('[CarrierSearch GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
