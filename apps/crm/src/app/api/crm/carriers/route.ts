import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/carriers
 * List carriers with optional state/type filters
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const carrierType = searchParams.get('carrier_type');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('insurance_carriers')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('carrier_name', { ascending: true });

    if (carrierType) {
      query = query.eq('carrier_type', carrierType);
    }
    if (search) {
      const safe = search.replace(/[%_,().\\]/g, '\\$&');
      query = query.ilike('carrier_name', `%${safe}%`);
    }

    // Filter by state availability
    if (state) {
      const { data: stateCarriers } = await supabase
        .from('carrier_state_availability')
        .select('carrier_id')
        .eq('organization_id', profile.organization_id)
        .eq('state', state.toUpperCase())
        .eq('is_active', true);

      const carrierIds = (stateCarriers || []).map((c) => c.carrier_id);
      if (carrierIds.length === 0) {
        return NextResponse.json({ data: [], total: 0 });
      }
      query = query.in('id', carrierIds);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[Carriers GET]', error);
      return NextResponse.json({ error: 'Failed to fetch carriers' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error('[Carriers GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createCarrierSchema = z.object({
  carrier_name: z.string().min(1).max(255),
  naic_code: z.string().max(20).optional(),
  website: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  carrier_type: z.enum(['insurance', 'healthshare', 'medicaid', 'short_term', 'dental', 'vision', 'life', 'other']).default('insurance'),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

/**
 * POST /api/crm/carriers
 * Create a new carrier
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
    const parsed = createCarrierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('insurance_carriers')
      .insert({
        organization_id: profile.organization_id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: 'Carrier already exists' }, { status: 409 });
      }
      console.error('[Carriers POST]', error);
      return NextResponse.json({ error: 'Failed to create carrier' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[Carriers POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
