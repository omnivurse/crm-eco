import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/locations?zip=<zip_code>&service_id=<optional>&limit=<optional>
 *
 * Returns nearby healthcare locations for a given ZIP code.
 * Used by: CRM, public website, member portal, admin portal.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
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

    const supabase = await createClient();

    // Call the get_nearby_locations RPC
    const { data, error } = await supabase.rpc('get_nearby_locations', {
      p_zip_code: zip,
      p_service_id: serviceId,
      p_limit: limit,
    });

    if (error) {
      console.error('Healthcare locations lookup error:', error);
      return NextResponse.json(
        { error: 'Failed to look up locations' },
        { status: 500 }
      );
    }

    const locations = (data || []) as Array<{
      location_id: string;
      name: string;
      location_type: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      phone: string;
      latitude: number;
      longitude: number;
      telehealth_capable: boolean;
      accepting_new_patients: boolean;
      services: Array<{ service_id: string; service_name: string; service_category: string }> | null;
    }>;

    return NextResponse.json({
      zip_code: zip,
      total_locations: locations.length,
      locations,
    });
  } catch (error) {
    console.error('Error in GET /api/healthcare/locations:', error);
    return NextResponse.json(
      { error: 'Failed to look up healthcare locations' },
      { status: 500 }
    );
  }
}
