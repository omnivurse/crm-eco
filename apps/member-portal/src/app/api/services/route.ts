import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

/**
 * GET /api/services?zip=<zip>&category=<optional>
 * Returns available healthcare services for a ZIP code.
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
    const category = searchParams.get('category') || null;

    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        { error: 'Valid 5-digit ZIP code required' },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase.rpc as any)('get_available_services', {
      p_zip_code: zip,
      p_category: category,
      p_plan_category: null,
    });

    if (error) {
      console.error('Healthcare services lookup error:', error);
      return NextResponse.json({ error: 'Failed to look up services' }, { status: 500 });
    }

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
    console.error('Error in GET /api/services:', error);
    return NextResponse.json({ error: 'Failed to look up services' }, { status: 500 });
  }
}
