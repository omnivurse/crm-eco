import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/networks?state=FL&type=ppo&active=true
 * List provider networks for the org, optionally filtered.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const state = searchParams.get('state')?.trim().toUpperCase() || null;
    const networkType = searchParams.get('type') || null;
    const active = searchParams.get('active');

    const supabase = await createClient();

    let query = supabase
      .from('provider_networks')
      .select('*, insurance_carriers(id, carrier_name, carrier_type)')
      .eq('organization_id', profile.organization_id)
      .order('network_name');

    if (state) {
      query = query.contains('coverage_states', [state]);
    }
    if (networkType) {
      query = query.eq('network_type', networkType);
    }
    if (active === 'true') {
      query = query.eq('is_active', true);
    } else if (active === 'false') {
      query = query.eq('is_active', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Networks list error:', error);
      return NextResponse.json({ error: 'Failed to list networks' }, { status: 500 });
    }

    return NextResponse.json({ networks: data || [] });
  } catch (error) {
    console.error('Error in GET /api/healthcare/networks:', error);
    return NextResponse.json({ error: 'Failed to list networks' }, { status: 500 });
  }
}

/**
 * POST /api/healthcare/networks
 * Create a new provider network.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { network_code, network_name, network_type, carrier_id, description, coverage_states } = body;

    if (!network_code || !network_name) {
      return NextResponse.json(
        { error: 'network_code and network_name are required' },
        { status: 400 }
      );
    }

    const validTypes = ['ppo', 'hmo', 'epo', 'pos', 'preferred', 'open', 'custom'];
    if (network_type && !validTypes.includes(network_type)) {
      return NextResponse.json(
        { error: `network_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('provider_networks')
      .insert({
        organization_id: profile.organization_id,
        network_code: network_code.trim(),
        network_name: network_name.trim(),
        network_type: network_type || 'ppo',
        carrier_id: carrier_id || null,
        description: description || null,
        coverage_states: coverage_states || [],
      })
      .select('*, insurance_carriers(id, carrier_name)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A network with this code already exists' },
          { status: 409 }
        );
      }
      console.error('Network create error:', error);
      return NextResponse.json({ error: 'Failed to create network' }, { status: 500 });
    }

    return NextResponse.json({ network: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/healthcare/networks:', error);
    return NextResponse.json({ error: 'Failed to create network' }, { status: 500 });
  }
}
