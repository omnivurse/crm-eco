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

// The carrier form always POSTs its optional inputs as empty strings when left
// blank. `z.string().url()/.email()` reject '' (and `.optional()` only permits
// `undefined`), so a carrier added with a blank Website/Email would fail
// validation — the reported "can't add LifeX / Object Error" bug. Treat blank
// strings as "not provided" so only actually-entered values are format-checked.
const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const createCarrierSchema = z.object({
  carrier_name: z.string().min(1).max(255),
  naic_code: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  website: z.preprocess(emptyToUndefined, z.string().url().optional()),
  logo_url: z.preprocess(emptyToUndefined, z.string().url().optional()),
  carrier_type: z.enum(['insurance', 'healthshare', 'medicaid', 'short_term', 'dental', 'vision', 'life', 'other']).default('insurance'),
  phone: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
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
      // Return a human-readable string, not the raw ZodIssue array — a client
      // that does `throw new Error(json.error)` would otherwise surface it as
      // "[object Object]".
      const message = parsed.error.errors
        .map((e) => `${e.path.join('.') || 'field'}: ${e.message}`)
        .join('; ');
      return NextResponse.json(
        { error: message || 'Invalid carrier data' },
        { status: 400 },
      );
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
