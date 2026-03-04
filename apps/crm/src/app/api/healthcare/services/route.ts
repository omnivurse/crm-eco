import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/services?zip=<zip_code>&category=<optional>&plan_category=<optional>
 *
 * Returns available healthcare services for a given ZIP code.
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
    const category = searchParams.get('category') || null;
    const planCategory = searchParams.get('plan_category') || null;

    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        { error: 'Valid 5-digit ZIP code required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Call the get_available_services RPC
    const { data, error } = await supabase.rpc('get_available_services', {
      p_zip_code: zip,
      p_category: category,
      p_plan_category: planCategory,
    });

    if (error) {
      console.error('Healthcare services lookup error:', error);
      return NextResponse.json(
        { error: 'Failed to look up services' },
        { status: 500 }
      );
    }

    // Group by category for UI convenience
    const services = (data || []) as Array<{
      service_id: string;
      service_code: string;
      service_name: string;
      service_category: string;
      description: string;
      provider_network: string;
      icon: string;
      color: string;
      coverage_level: string;
      location_count: number;
      nearest_location: Record<string, unknown> | null;
    }>;

    const byCategory: Record<string, typeof services> = {};
    for (const svc of services) {
      if (!byCategory[svc.service_category]) {
        byCategory[svc.service_category] = [];
      }
      byCategory[svc.service_category].push(svc);
    }

    return NextResponse.json({
      zip_code: zip,
      total_services: services.length,
      services,
      by_category: byCategory,
    });
  } catch (error) {
    console.error('Error in GET /api/healthcare/services:', error);
    return NextResponse.json(
      { error: 'Failed to look up healthcare services' },
      { status: 500 }
    );
  }
}
