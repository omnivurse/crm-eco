import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/networks/search?network_id=<uuid>&zip=33601&service_category=urgent_care&tier=in_network&radius=50&limit=20
 * In-network provider search using the search_in_network_providers RPC.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const networkId = searchParams.get('network_id');
    const zip = searchParams.get('zip')?.trim();
    const serviceCategory = searchParams.get('service_category') || null;
    const tier = searchParams.get('tier') || null;
    const radius = Number(searchParams.get('radius') || '50');
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 100);

    if (!networkId) {
      return NextResponse.json({ error: 'network_id is required' }, { status: 400 });
    }
    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: 'Valid 5-digit ZIP code required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get network name for response
    const { data: network } = await supabase
      .from('provider_networks')
      .select('network_name')
      .eq('id', networkId)
      .single();

    const { data, error } = await supabase.rpc('search_in_network_providers', {
      p_network_id: networkId,
      p_zip_code: zip,
      p_service_category: serviceCategory,
      p_tier: tier,
      p_radius_miles: radius,
      p_limit: limit,
    });

    if (error) {
      console.error('Network provider search error:', error);
      return NextResponse.json({ error: 'Failed to search providers' }, { status: 500 });
    }

    return NextResponse.json({
      zip_code: zip,
      network_name: network?.network_name || 'Unknown',
      total: (data || []).length,
      providers: data || [],
    });
  } catch (error) {
    console.error('Error in GET /api/healthcare/networks/search:', error);
    return NextResponse.json({ error: 'Failed to search providers' }, { status: 500 });
  }
}
