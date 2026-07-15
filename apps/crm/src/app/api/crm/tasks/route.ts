import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';
import { withIdempotency } from '@/lib/server/idempotency';

const createTaskSchema = z.object({
  record_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  due_at: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'medium', 'high', 'urgent']).optional(),
  activity_type: z.enum(['task', 'call', 'email', 'meeting']).optional(),
  // Optional completion metadata so callers like SendEmailDialog can log a
  // completed email activity in a single round-trip. Defaults to an open
  // task to preserve existing behaviour.
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
  completed_at: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
});

// Map 'medium' to 'normal' for database compatibility
function mapPriority(priority: string | undefined): string {
  if (priority === 'medium') return 'normal';
  return priority || 'normal';
}

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
    // Optional date range — used by the calendar view to pull only tasks
    // whose `due_at` lands in the visible month. Both are ISO timestamps.
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    // Optional status filter; calendar view wants "open"/"in_progress" only
    // so completed tasks don't clutter the month grid.
    const statusCsv = searchParams.get('status');

    let query = supabase
      .from('crm_tasks')
      .select('*')
      .eq('org_id', profile.organization_id)
      .is('deleted_at' as never, null)
      .order('created_at', { ascending: false });

    if (recordId) {
      query = query.eq('record_id', recordId);
    }
    if (start) {
      query = query.gte('due_at', start);
    }
    if (end) {
      query = query.lte('due_at', end);
    }
    if (statusCsv) {
      const statuses = statusCsv.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in('status', statuses);
      }
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

    const rawBody = await request.text();

    const { response } = await withIdempotency(
      {
        organizationId: profile.organization_id,
        method: 'POST',
        path: '/api/crm/tasks',
        rawBody,
      },
      request,
      async () => {
        let body: unknown;
        try {
          body = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: 400 },
          );
        }
        const parsed = createTaskSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.errors },
            { status: 400 },
          );
        }

        const supabase = await createCrmClient();

        const status = parsed.data.status || 'open';
        // Normalize completed_at: if caller said the task is completed
        // but didn't stamp a time, set it to now so insight queries
        // aggregating by hour still have a signal.
        const completedAt =
          status === 'completed'
            ? parsed.data.completed_at || new Date().toISOString()
            : parsed.data.completed_at || null;

        const { data: task, error } = await supabase
          .from('crm_tasks')
          .insert({
            org_id: profile.organization_id,
            record_id: parsed.data.record_id,
            title: parsed.data.title,
            description: parsed.data.description || null,
            due_at: parsed.data.due_at || null,
            priority: mapPriority(parsed.data.priority),
            activity_type: parsed.data.activity_type || 'task',
            status,
            completed_at: completedAt,
            outcome: parsed.data.outcome || null,
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
      },
    );

    return response;
  } catch (error) {
    console.error('Error in POST /api/crm/tasks:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
