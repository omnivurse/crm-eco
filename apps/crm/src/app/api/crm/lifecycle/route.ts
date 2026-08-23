import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const VALID_EVENT_TYPES = ['enrolled', 'cancelled', 'returned', 'paused'] as const;
const VALID_REASONS = [
  'cost', 'coverage_change', 'moved_state', 'joined_medicaid',
  'joined_employer_plan', 'dissatisfied', 'non_payment', 'aging_out',
  'life_event', 'better_option', 'voluntary', 'involuntary', 'other',
] as const;

const createEventSchema = z.object({
  contact_id: z.string().uuid(),
  event_type: z.enum(VALID_EVENT_TYPES),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(VALID_REASONS).nullable().optional(),
  reason_detail: z.string().max(1000).optional(),
  plan_type: z.enum(['healthshare', 'insurance', 'medicaid', 'short_term']).nullable().optional(),
  advisor_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/crm/lifecycle
 * List lifecycle events with filters.
 * “Ever cancelled” = `?event_type=cancelled` on this table, not History-module rows.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    const eventType = searchParams.get('event_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('member_lifecycle_events')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }
    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[Lifecycle GET]', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error('[Lifecycle GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/lifecycle
 * Record a new lifecycle event
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('member_lifecycle_events')
      .insert({
        organization_id: profile.organization_id,
        created_by: profile.id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      console.error('[Lifecycle POST]', error);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[Lifecycle POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
