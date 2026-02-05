import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

/**
 * GET /api/tasks
 * List tasks for the current organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const recordId = searchParams.get('record_id');
    const activityType = searchParams.get('activity_type');

    let query = supabase
      .from('crm_tasks')
      .select(`
        *,
        assignee:profiles!crm_tasks_assigned_to_fkey(id, full_name, avatar_url),
        created_by_profile:profiles!crm_tasks_created_by_fkey(id, full_name, avatar_url)
      `)
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (recordId) {
      query = query.eq('record_id', recordId);
    }

    if (activityType) {
      query = query.eq('activity_type', activityType);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error('Get tasks error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(tasks || []);
  } catch (error) {
    console.error('Get tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'medium', 'high', 'urgent']).optional().default('normal'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().default('pending'),
  due_date: z.string().optional(),
  record_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  activity_type: z.enum(['task', 'call', 'meeting', 'email']).optional().default('task'),
});

/**
 * POST /api/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Map 'medium' priority to 'normal' for the database
    const priority = parsed.data.priority === 'medium' ? 'normal' : parsed.data.priority;

    // Map 'pending' status to 'open' for the database
    const status = parsed.data.status === 'pending' ? 'open' : parsed.data.status;

    const { data: task, error } = await supabase
      .from('crm_tasks')
      .insert({
        org_id: profile.organization_id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        priority: priority,
        status: status,
        due_at: parsed.data.due_date ? new Date(parsed.data.due_date).toISOString() : null,
        record_id: parsed.data.record_id || null,
        assigned_to: parsed.data.assigned_to || profile.id,
        created_by: profile.id,
        activity_type: parsed.data.activity_type || 'task',
      })
      .select()
      .single();

    if (error) {
      console.error('Create task error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
