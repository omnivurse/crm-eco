import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TRIGGER_TYPES = [
  'on_create', 'on_update', 'on_stage_change',
  'field_value_changed', 'scheduled', 'webform', 'inbound_webhook',
] as const;

// ---------------------------------------------------------------------------
// GET /api/automation/workflows/triggers?workflow_id=<uuid>
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workflowId = request.nextUrl.searchParams.get('workflow_id');
    if (!workflowId) {
      return NextResponse.json({ error: 'Missing workflow_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('crm_workflow_triggers')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('organization_id', profile.organization_id)
      .order('created_at');

    if (error) {
      console.error('[WorkflowTriggers] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch triggers' }, { status: 500 });
    }

    return NextResponse.json({ triggers: data || [] });
  } catch (error) {
    console.error('[WorkflowTriggers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/automation/workflows/triggers — create a trigger
// ---------------------------------------------------------------------------
const createTriggerSchema = z.object({
  workflow_id: z.string().uuid(),
  trigger_type: z.enum(TRIGGER_TYPES),
  name: z.string().max(200).optional(),
  config: z.record(z.unknown()).optional(),
  watch_fields: z.array(z.string()).optional(),
  from_value: z.string().optional().nullable(),
  to_value: z.string().optional().nullable(),
  cron_expression: z.string().max(100).optional().nullable(),
  timezone: z.string().max(50).optional(),
  is_enabled: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createTriggerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Verify workflow belongs to this org
    const { data: workflow } = await supabase
      .from('crm_workflows')
      .select('id')
      .eq('id', parsed.data.workflow_id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('crm_workflow_triggers')
      .insert({
        workflow_id: parsed.data.workflow_id,
        organization_id: profile.organization_id,
        trigger_type: parsed.data.trigger_type,
        name: parsed.data.name || null,
        config: parsed.data.config || {},
        watch_fields: parsed.data.watch_fields || null,
        from_value: parsed.data.from_value || null,
        to_value: parsed.data.to_value || null,
        cron_expression: parsed.data.cron_expression || null,
        timezone: parsed.data.timezone || 'UTC',
        is_enabled: parsed.data.is_enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('[WorkflowTriggers] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create trigger' }, { status: 500 });
    }

    return NextResponse.json({ trigger: data }, { status: 201 });
  } catch (error) {
    console.error('[WorkflowTriggers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/automation/workflows/triggers — update a trigger
// ---------------------------------------------------------------------------
const updateTriggerSchema = z.object({
  id: z.string().uuid(),
  trigger_type: z.enum(TRIGGER_TYPES).optional(),
  name: z.string().max(200).optional().nullable(),
  config: z.record(z.unknown()).optional(),
  watch_fields: z.array(z.string()).optional().nullable(),
  from_value: z.string().optional().nullable(),
  to_value: z.string().optional().nullable(),
  cron_expression: z.string().max(100).optional().nullable(),
  timezone: z.string().max(50).optional(),
  is_enabled: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateTriggerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_workflow_triggers')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[WorkflowTriggers] Update error:', error);
      return NextResponse.json({ error: 'Failed to update trigger' }, { status: 500 });
    }

    return NextResponse.json({ trigger: data });
  } catch (error) {
    console.error('[WorkflowTriggers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/automation/workflows/triggers?id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing trigger id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_workflow_triggers')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[WorkflowTriggers] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete trigger' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WorkflowTriggers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
