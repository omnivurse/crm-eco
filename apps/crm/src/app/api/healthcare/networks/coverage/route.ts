import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/networks/coverage?network_id=<uuid>&zip=33601
 * GET /api/healthcare/networks/coverage?network_id=<uuid>&state=FL
 * Coverage score lookup using get_network_coverage_score RPC.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const networkId = searchParams.get('network_id');
    const zip = searchParams.get('zip')?.trim() || null;
    const state = searchParams.get('state')?.trim().toUpperCase() || null;

    if (!networkId) {
      return NextResponse.json({ error: 'network_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_network_coverage_score', {
      p_network_id: networkId,
      p_zip_code: zip,
      p_state: state,
    });

    if (error) {
      console.error('Coverage score error:', error);
      return NextResponse.json({ error: 'Failed to get coverage score' }, { status: 500 });
    }

    const results = data || [];
    return NextResponse.json({
      network_id: networkId,
      network_name: results[0]?.network_name || 'Unknown',
      filter: { zip, state },
      total: results.length,
      coverage: results,
    });
  } catch (error) {
    console.error('Error in GET /api/healthcare/networks/coverage:', error);
    return NextResponse.json({ error: 'Failed to get coverage score' }, { status: 500 });
  }
}
