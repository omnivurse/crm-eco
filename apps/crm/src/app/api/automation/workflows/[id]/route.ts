import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { getWorkflowById, updateWorkflow, deleteWorkflow } from '@/lib/automation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/automation/workflows/[id]
 * Get a single workflow by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workflow = await getWorkflowById(id);

    if (!workflow || workflow.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Get workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  trigger_type: z.enum(['on_create', 'on_update', 'scheduled', 'webform']).optional(),
  trigger_config: z.record(z.unknown()).optional(),
  conditions: z.unknown().optional(),
  actions: z.array(z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
  priority: z.number().optional(),
});

/**
 * PATCH /api/automation/workflows/[id]
 * Update a workflow
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify workflow belongs to org
    const existing = await getWorkflowById(id);
    if (!existing || existing.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const workflow = await updateWorkflow(id, parsed.data as any);

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Update workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/automation/workflows/[id]
 * Delete a workflow
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify workflow belongs to org
    const existing = await getWorkflowById(id);
    if (!existing || existing.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await deleteWorkflow(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
