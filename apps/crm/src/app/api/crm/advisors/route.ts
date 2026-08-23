import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { producerDisplayName, producerSearchOrFilter } from '@/lib/crm/advisor-search';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/advisors — the "Enrolled by" / producer picker source.
 *
 * Reads `public.advisors` (the org's producers — 672 live rows for PIFH,
 * 94% of stored producer spellings; decision D5 as adjusted by the Road to
 * Ten orchestrator). `crm_advisors` is DB-commented DEPRECATED and empty.
 *
 * Scope: `organization_id = profile.organization_id` in the query AND the
 * table's own RLS ("Users can view advisors in their organization" /
 * "Staff can read advisors", both org-pinned) — two tenants never see each
 * other's producers; anon is 401 before any query.
 *
 * Query: `search` (ilike over full_name / first_name / last_name /
 * agency_name), `is_active=true|false`, `state`, `limit` (≤500), `offset`.
 * Returns `{ data: [{ id, name, first_name, last_name, full_name, agency_name,
 * state, is_active, advisor_name }], total }` — `advisor_name` mirrors `name`
 * for callers written against the old crm_advisors shape. Names only: no
 * email / phone / license data leaves this route.
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
    const search = (searchParams.get('search') ?? '').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    let query = supabase
      .from('advisors')
      .select('id, first_name, last_name, full_name, agency_name, state, is_active', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .is('deleted_at', null)
      .order('full_name', { ascending: true, nullsFirst: false })
      .order('last_name', { ascending: true, nullsFirst: false })
      .order('first_name', { ascending: true, nullsFirst: false });

    if (state) {
      query = query.eq('state', state);
    }
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true');
    }
    if (search) {
      query = query.or(producerSearchOrFilter(search));
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[Advisors GET]', error);
      return NextResponse.json({ error: 'Failed to fetch advisors' }, { status: 500 });
    }

    const rows = (data ?? []).map((row) => {
      const name = producerDisplayName(row);
      return { ...row, name, advisor_name: name };
    });
    return NextResponse.json({ data: rows, total: count || 0 });
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
 * Create a new advisor (legacy crm_advisors store — unchanged; the picker
 * never POSTs, free text goes on the record as typed per D5).
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
