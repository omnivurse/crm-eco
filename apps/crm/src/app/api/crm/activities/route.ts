import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';

const createActivitySchema = z.object({
  record_id: z.string().uuid(),
  type: z.enum(['call', 'email', 'meeting', 'note', 'other']),
  outcome: z.string().optional(),
  subject: z.string().optional(),
  description: z.string().optional(),
  duration_minutes: z.number().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  contact_method: z.string().optional(),
});

/**
 * GET /api/crm/activities
 * Get activities for a specific record or all activities
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createCrmClient();
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('crm_activities')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (recordId) {
      query = query.eq('record_id', recordId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/crm/activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/activities
 * Create a new activity (call log, meeting, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createActivitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createCrmClient();

    const { data: activity, error } = await supabase
      .from('crm_activities')
      .insert({
        org_id: profile.organization_id,
        record_id: parsed.data.record_id,
        type: parsed.data.type,
        outcome: parsed.data.outcome || null,
        subject: parsed.data.subject || (parsed.data.type === 'call' ? 'Call logged' : null),
        description: parsed.data.description || null,
        duration_minutes: parsed.data.duration_minutes || null,
        direction: parsed.data.direction || 'outbound',
        contact_method: parsed.data.contact_method || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/crm/activities:', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}
