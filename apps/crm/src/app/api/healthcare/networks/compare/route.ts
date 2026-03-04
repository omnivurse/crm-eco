import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/networks/compare?network_ids=<uuid1>,<uuid2>,<uuid3>&zip=33601
 * Side-by-side network comparison using compare_network_coverage RPC.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const networkIdsStr = searchParams.get('network_ids');
    const zip = searchParams.get('zip')?.trim();

    if (!networkIdsStr) {
      return NextResponse.json({ error: 'network_ids is required (comma-separated UUIDs)' }, { status: 400 });
    }
    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: 'Valid 5-digit ZIP code required' }, { status: 400 });
    }

    const networkIds = networkIdsStr.split(',').map((id) => id.trim()).filter(Boolean);
    if (networkIds.length < 2) {
      return NextResponse.json({ error: 'At least 2 network IDs are required for comparison' }, { status: 400 });
    }
    if (networkIds.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 networks can be compared at once' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('compare_network_coverage', {
      p_network_ids: networkIds,
      p_zip_code: zip,
    });

    if (error) {
      console.error('Network comparison error:', error);
      return NextResponse.json({ error: 'Failed to compare networks' }, { status: 500 });
    }

    return NextResponse.json({
      zip_code: zip,
      total: (data || []).length,
      networks: data || [],
    });
  } catch (error) {
    console.error('Error in GET /api/healthcare/networks/compare:', error);
    return NextResponse.json({ error: 'Failed to compare networks' }, { status: 500 });
  }
}
