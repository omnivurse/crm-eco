import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

/**
 * GET /api/services/locations?zip=<zip>&service_id=<optional>&limit=<optional>
 * Returns nearby healthcare locations for a ZIP code.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const zip = searchParams.get('zip')?.trim();
    const serviceId = searchParams.get('service_id') || null;
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 50);

    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        { error: 'Valid 5-digit ZIP code required' },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase.rpc as any)('get_nearby_locations', {
      p_zip_code: zip,
      p_service_id: serviceId,
      p_limit: limit,
    });

    if (error) {
      console.error('Healthcare locations lookup error:', error);
      return NextResponse.json({ error: 'Failed to look up locations' }, { status: 500 });
    }

    return NextResponse.json({
      zip_code: zip,
      total_locations: (data || []).length,
      locations: data || [],
    });
  } catch (error) {
    console.error('Error in GET /api/services/locations:', error);
    return NextResponse.json({ error: 'Failed to look up locations' }, { status: 500 });
  }
}
