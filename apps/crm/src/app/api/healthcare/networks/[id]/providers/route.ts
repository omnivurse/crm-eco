import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/networks/:id/providers?tier=in_network&specialty=urgent_care&page=1&per_page=50
 * List providers in a network with optional filters and pagination.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const tier = searchParams.get('tier') || null;
    const specialty = searchParams.get('specialty') || null;
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('per_page') || '50')));
    const offset = (page - 1) * perPage;

    const supabase = await createClient();

    let query = supabase
      .from('network_providers')
      .select(
        `*,
         healthcare_locations(id, name, location_type, address_line1, city, state, zip, phone, latitude, longitude, accepting_new_patients),
         provider_locations(id, name, provider_type, address_line1, city, state, zip, phone, latitude, longitude, accepting_patients, rating, review_count)`,
        { count: 'exact' }
      )
      .eq('network_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (tier) {
      query = query.eq('network_tier', tier);
    }
    if (specialty) {
      query = query.contains('specialty_tags', [specialty]);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Network providers list error:', error);
      return NextResponse.json({ error: 'Failed to list providers' }, { status: 500 });
    }

    return NextResponse.json({
      providers: data || [],
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/healthcare/networks/[id]/providers:', error);
    return NextResponse.json({ error: 'Failed to list providers' }, { status: 500 });
  }
}

/**
 * POST /api/healthcare/networks/:id/providers
 * Add a provider to a network.
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
    const body = await request.json();
    const {
      healthcare_location_id,
      provider_location_id,
      network_tier,
      tier_discount_pct,
      specialty_tags,
      accepting_new_patients,
    } = body;

    if (!healthcare_location_id && !provider_location_id) {
      return NextResponse.json(
        { error: 'At least one of healthcare_location_id or provider_location_id is required' },
        { status: 400 }
      );
    }

    const validTiers = ['in_network_preferred', 'in_network', 'out_of_network'];
    if (network_tier && !validTiers.includes(network_tier)) {
      return NextResponse.json(
        { error: `network_tier must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('network_providers')
      .insert({
        network_id: id,
        healthcare_location_id: healthcare_location_id || null,
        provider_location_id: provider_location_id || null,
        network_tier: network_tier || 'in_network',
        tier_discount_pct: tier_discount_pct || 0,
        specialty_tags: specialty_tags || [],
        accepting_new_patients: accepting_new_patients ?? true,
      })
      .select('*, healthcare_locations(id, name), provider_locations(id, name)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This provider is already in the network' },
          { status: 409 }
        );
      }
      console.error('Add network provider error:', error);
      return NextResponse.json({ error: 'Failed to add provider' }, { status: 500 });
    }

    return NextResponse.json({ provider: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/healthcare/networks/[id]/providers:', error);
    return NextResponse.json({ error: 'Failed to add provider' }, { status: 500 });
  }
}
