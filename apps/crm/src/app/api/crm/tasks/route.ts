import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';

const createTaskSchema = z.object({
  record_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  due_at: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  activity_type: z.enum(['task', 'call', 'email', 'meeting']).optional(),
});

/**
 * GET /api/crm/tasks
 * Get tasks for a specific record or all tasks
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

    let query = supabase
      .from('crm_tasks')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (recordId) {
      query = query.eq('record_id', recordId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/crm/tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/tasks
 * Create a new task
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
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createCrmClient();

    const { data: task, error } = await supabase
      .from('crm_tasks')
      .insert({
        org_id: profile.organization_id,
        record_id: parsed.data.record_id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        due_at: parsed.data.due_at || null,
        priority: parsed.data.priority || 'medium',
        activity_type: parsed.data.activity_type || 'task',
        status: 'open',
        assigned_to: profile.id,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/crm/tasks:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
