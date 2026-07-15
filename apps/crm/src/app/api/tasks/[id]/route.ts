import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
  due_at: z.string().optional(),
  completed_at: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  follow_up_note: z.string().optional(),
  repeat_interval_days: z.number().int().nonnegative().optional(),
});

/**
 * PATCH /api/tasks/[id]
 * Update a task (status, due_at, etc.)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (
      !profile.crm_role ||
      !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Build update payload — only include provided fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.due_at !== undefined) updates.due_at = parsed.data.due_at;
    if (parsed.data.completed_at !== undefined) updates.completed_at = parsed.data.completed_at;
    if (parsed.data.assigned_to !== undefined) updates.assigned_to = parsed.data.assigned_to;
    if (parsed.data.follow_up_note !== undefined)
      updates.follow_up_note = parsed.data.follow_up_note;
    if (parsed.data.repeat_interval_days !== undefined)
      updates.repeat_interval_days = parsed.data.repeat_interval_days;

    const { data: task, error } = await supabase
      .from('crm_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('Update task error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/tasks/[id]
 * Get a single task by ID
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: task, error } = await supabase
      .from('crm_tasks')
      .select(
        `*,
         assignee:profiles!crm_tasks_assigned_to_fkey(id, full_name, avatar_url),
         created_by_profile:profiles!crm_tasks_created_by_fkey(id, full_name, avatar_url)`
      )
      .eq('id', taskId)
      .eq('org_id', profile.organization_id)
      .single();

    if (error) {
      console.error('Get task error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tasks/[id]
 * Permanently delete a task/activity. Org-scoped so a task can only be removed
 * within the caller's organization.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (
      !profile.crm_role ||
      !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft-delete (move to Trash) instead of a physical delete so it can be
    // restored via Undo. Because this is an UPDATE (not DELETE) it is governed
    // by the task UPDATE policy, which resolves the old agent-vs-RLS mismatch.
    const { data: deleted, error } = await (supabase as any)
      .from('crm_tasks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id, deleted_origin: 'user' })
      .eq('id', taskId)
      .eq('org_id', profile.organization_id)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      console.error('Delete task error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: taskId, trashed: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
