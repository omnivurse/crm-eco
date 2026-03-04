import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/advisors
 * List advisors with optional filters (state, is_active, search)
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
    const isActive = searchParams.get('is_active');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('crm_advisors')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('advisor_name', { ascending: true });

    if (state) {
      query = query.eq('state', state);
    }
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true');
    }
    if (search) {
      const safe = search.replace(/[%_,().\\]/g, '\\$&');
      query = query.or(`advisor_name.ilike.%${safe}%,agency_name.ilike.%${safe}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[Advisors GET]', error);
      return NextResponse.json({ error: 'Failed to fetch advisors' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error('[Advisors GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createAdvisorSchema = z.object({
  advisor_name: z.string().min(1).max(255),
  agency_name: z.string().max(255).optional(),
  state: z.string().max(2).optional(),
  user_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

/**
 * POST /api/crm/advisors
 * Create a new advisor
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
    const parsed = createAdvisorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_advisors')
      .insert({
        organization_id: profile.organization_id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      console.error('[Advisors POST]', error);
      return NextResponse.json({ error: 'Failed to create advisor' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[Advisors POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
