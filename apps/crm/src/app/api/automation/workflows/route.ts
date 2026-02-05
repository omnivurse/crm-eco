import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { getWorkflows, createWorkflow } from '@/lib/automation';

/**
 * GET /api/automation/workflows
 * List all workflows for the current organization
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Need to check role from profile, but getAuthProfile doesn't return role
    // So we need to fetch it separately
    const supabase = await createClient();
    const { data: profileWithRole } = await supabase
      .from('profiles')
      .select('organization_id, crm_role, role')
      .eq('user_id', profile.user_id)
      .single();

    if (!profileWithRole) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Allow access for CRM roles or admin/owner platform roles
    if (!profileWithRole.crm_role && !['owner', 'admin'].includes(profileWithRole.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');

    const workflows = await getWorkflows(
      profileWithRole.organization_id,
      moduleId || undefined
    );

    return NextResponse.json(workflows);
  } catch (error) {
    console.error('Get workflows error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createWorkflowSchema = z.object({
  module_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  trigger_type: z.enum(['on_create', 'on_update', 'scheduled', 'webform']),
  trigger_config: z.record(z.unknown()).optional(),
  conditions: z.unknown(),
  actions: z.array(z.unknown()),
  is_enabled: z.boolean().optional(),
  priority: z.number().optional(),
});

/**
 * POST /api/automation/workflows
 * Create a new workflow
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
    const parsed = createWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const workflow = await createWorkflow({
      org_id: profile.organization_id,
      module_id: parsed.data.module_id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      trigger_type: parsed.data.trigger_type,
      trigger_config: parsed.data.trigger_config || {},
      conditions: parsed.data.conditions as any,
      actions: parsed.data.actions as any,
      is_enabled: parsed.data.is_enabled ?? true,
      priority: parsed.data.priority || 100,
      webhook_secret: null,
      created_by: profile.id,
    });

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Create workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
