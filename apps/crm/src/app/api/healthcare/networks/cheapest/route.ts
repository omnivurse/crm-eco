import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/networks/cheapest?network_id=<uuid>&procedure_id=<uuid>&zip=33601&radius=50&limit=10
 * Cost-optimized provider routing using find_cheapest_in_network_provider RPC.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const networkId = searchParams.get('network_id');
    const procedureId = searchParams.get('procedure_id');
    const zip = searchParams.get('zip')?.trim();
    const radius = Number(searchParams.get('radius') || '50');
    const limit = Math.min(Number(searchParams.get('limit') || '10'), 50);

    if (!networkId) {
      return NextResponse.json({ error: 'network_id is required' }, { status: 400 });
    }
    if (!procedureId) {
      return NextResponse.json({ error: 'procedure_id is required' }, { status: 400 });
    }
    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: 'Valid 5-digit ZIP code required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get context names for response
    const [{ data: network }, { data: procedure }] = await Promise.all([
      supabase.from('provider_networks').select('network_name').eq('id', networkId).single(),
      supabase.from('medical_procedures').select('procedure_name').eq('id', procedureId).single(),
    ]);

    const { data, error } = await supabase.rpc('find_cheapest_in_network_provider', {
      p_network_id: networkId,
      p_procedure_id: procedureId,
      p_zip_code: zip,
      p_radius_miles: radius,
      p_limit: limit,
    });

    if (error) {
      console.error('Cheapest provider search error:', error);
      return NextResponse.json({ error: 'Failed to find cheapest providers' }, { status: 500 });
    }

    return NextResponse.json({
      zip_code: zip,
      network_name: network?.network_name || 'Unknown',
      procedure_name: procedure?.procedure_name || 'Unknown',
      total: (data || []).length,
      providers: data || [],
    });
  } catch (error) {
    console.error('Error in GET /api/healthcare/networks/cheapest:', error);
    return NextResponse.json({ error: 'Failed to find cheapest providers' }, { status: 500 });
  }
}
