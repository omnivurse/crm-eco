import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

/**
 * GET /api/pricing/search?zip=<zip>&procedure=<name>&category=<optional>
 * Search cash prices for medical procedures near a ZIP code.
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
    const procedure = searchParams.get('procedure') || null;
    const category = searchParams.get('category') || null;
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 50);

    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        { error: 'Valid 5-digit ZIP code required' },
        { status: 400 }
      );
    }

    // RPC not yet in generated types — cast to bypass until types are regenerated
    const { data, error } = await (supabase.rpc as any)('search_procedure_prices', {
      p_zip_code: zip,
      p_procedure_name: procedure,
      p_category: category,
      p_radius_miles: 50,
      p_limit: limit,
    });

    if (error) {
      console.error('Pricing search error:', error);
      return NextResponse.json({ error: 'Failed to search pricing' }, { status: 500 });
    }

    return NextResponse.json({
      zip_code: zip,
      total: (data || []).length,
      results: data || [],
    });
  } catch (error) {
    console.error('Error in GET /api/pricing/search:', error);
    return NextResponse.json({ error: 'Failed to search pricing' }, { status: 500 });
  }
}
