/**
 * PATCH /api/crm/tasks/[id]
 *
 * Narrow update endpoint for tasks — currently supports updating due_at,
 * status, priority, title, and description. Primarily consumed by the
 * calendar view's drag-to-reschedule flow, but deliberately generic so
 * other surfaces (mini task card quick-edits) can share it.
 *
 * Authz:
 *   - Requires any CRM role; RLS enforces org scope so the DB is the
 *     final gate. We also do a pre-flight `SELECT` so the endpoint can
 *     return 404 vs 500 cleanly.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';

export const dynamic = 'force-dynamic';

const patchTaskSchema = z
  .object({
    due_at: z.string().datetime().nullable().optional(),
    status: z
      .enum(['open', 'in_progress', 'completed', 'cancelled'])
      .optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    completed_at: z.string().datetime().nullable().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const crmRole = (profile as { crm_role?: string }).crm_role;
  if (
    !crmRole ||
    !['crm_admin', 'crm_manager', 'crm_agent'].includes(crmRole)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  // If the caller explicitly marks the task complete but didn't stamp
  // `completed_at`, fill it in so reporting queries (insights, velocity)
  // always have a concrete timestamp to aggregate by.
  if (updates.status === 'completed' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }
  // Equally, if the caller reopens a completed task we clear the stamp so
  // completion time doesn't lie about the current state.
  if (
    updates.status &&
    updates.status !== 'completed' &&
    !('completed_at' in updates)
  ) {
    updates.completed_at = null;
  }

  const supabase = await createCrmClient();

  const { data: existing, error: existingErr } = await supabase
    .from('crm_tasks')
    .select('id')
    .eq('id', id)
    .eq('org_id', profile.organization_id)
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json(
      { error: existingErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('crm_tasks')
    .update(updates)
    .eq('id', id)
    .eq('org_id', profile.organization_id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
