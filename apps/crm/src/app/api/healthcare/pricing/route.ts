import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/pricing?zip=<zip>&procedure=<name>&category=<optional>
 * Search cash prices for medical procedures near a ZIP code.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
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

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('search_procedure_prices', {
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
    console.error('Error in GET /api/healthcare/pricing:', error);
    return NextResponse.json({ error: 'Failed to search pricing' }, { status: 500 });
  }
}

/**
 * POST /api/healthcare/pricing
 * Upsert a procedure price entry (admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { procedure_id, provider_location_id, cash_price, discounted_price, price_range_low, price_range_high, source, notes } = body;

    if (!procedure_id || !provider_location_id || cash_price == null) {
      return NextResponse.json(
        { error: 'procedure_id, provider_location_id, and cash_price are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('procedure_prices')
      .upsert(
        {
          procedure_id,
          provider_location_id,
          cash_price,
          discounted_price: discounted_price || null,
          price_range_low: price_range_low || null,
          price_range_high: price_range_high || null,
          source: source || 'manual',
          notes: notes || null,
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: 'procedure_id,provider_location_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Upsert price error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ price: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/healthcare/pricing:', error);
    return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 });
  }
}
