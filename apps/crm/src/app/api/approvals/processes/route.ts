import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  getApprovalProcesses,
  getApprovalProcess,
  createApprovalProcessRecord,
  updateApprovalProcessRecord,
  deleteApprovalProcess,
} from '@/lib/approvals';
import type { ApprovalTriggerConfig, ApprovalStep, CrmApprovalProcess } from '@/lib/approvals/types';
import type { ConditionGroup, Condition } from '@/lib/automation/types';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

const stepSchema = z.object({
  type: z.enum(['role', 'user', 'manager', 'record_owner']),
  value: z.string(),
  require_comment: z.boolean().optional(),
  can_delegate: z.boolean().optional(),
  timeout_hours: z.number().optional(),
});

const createProcessSchema = z.object({
  module_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  is_enabled: z.boolean().optional(),
  trigger_type: z.enum(['stage_transition', 'field_change', 'record_create', 'manual']),
  trigger_config: z.object({
    stage_from: z.string().optional(),
    stage_to: z.string().optional(),
    field: z.string().optional(),
    condition: z.object({
      operator: z.string(),
      value: z.unknown(),
    }).optional(),
  }).optional(),
  conditions: z.union([
    z.object({
      logic: z.enum(['AND', 'OR']),
      conditions: z.array(z.object({
        field: z.string(),
        operator: z.string(),
        value: z.unknown(),
      })),
    }),
    z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown(),
    })),
  ]).optional(),
  steps: z.array(stepSchema),
  on_approve_actions: z.array(z.unknown()).optional(),
  on_reject_actions: z.array(z.unknown()).optional(),
  auto_approve_after_hours: z.number().nullable().optional(),
});

const updateProcessSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  is_enabled: z.boolean().optional(),
  trigger_type: z.enum(['stage_transition', 'field_change', 'record_create', 'manual']).optional(),
  trigger_config: z.object({
    stage_from: z.string().optional(),
    stage_to: z.string().optional(),
    field: z.string().optional(),
    condition: z.object({
      operator: z.string(),
      value: z.unknown(),
    }).optional(),
  }).optional(),
  conditions: z.union([
    z.object({
      logic: z.enum(['AND', 'OR']),
      conditions: z.array(z.object({
        field: z.string(),
        operator: z.string(),
        value: z.unknown(),
      })),
    }),
    z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown(),
    })),
  ]).optional(),
  steps: z.array(stepSchema).optional(),
  on_approve_actions: z.array(z.unknown()).optional(),
  on_reject_actions: z.array(z.unknown()).optional(),
  auto_approve_after_hours: z.number().nullable().optional(),
});

/**
 * GET /api/approvals/processes
 * Get approval processes
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');
    const processId = searchParams.get('id');

    // Get single process
    if (processId) {
      const process = await getApprovalProcess(processId);
      if (!process || process.org_id !== profile.organization_id) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }
      return NextResponse.json({ process });
    }

    // Get all processes
    const processes = await getApprovalProcesses(
      profile.organization_id,
      moduleId || undefined
    );

    // Get related data for list view
    const { data: processesWithModules } = await supabase
      .from('crm_approval_processes')
      .select(`
        *,
        module:crm_modules(name, key)
      `)
      .eq('org_id', profile.organization_id)
      .order('name');

    return NextResponse.json({ processes: processesWithModules || processes });
  } catch (error) {
    console.error('Get approval processes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals/processes
 * Create a new approval process
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createProcessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await createApprovalProcessRecord({
      org_id: profile.organization_id,
      module_id: parsed.data.module_id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      is_enabled: parsed.data.is_enabled ?? true,
      trigger_type: parsed.data.trigger_type,
      trigger_config: (parsed.data.trigger_config || {}) as ApprovalTriggerConfig,
      conditions: (parsed.data.conditions || []) as ConditionGroup | Condition[],
      steps: parsed.data.steps as ApprovalStep[],
      on_approve_actions: parsed.data.on_approve_actions || [],
      on_reject_actions: parsed.data.on_reject_actions || [],
      auto_approve_after_hours: parsed.data.auto_approve_after_hours ?? null,
      created_by: profile.id,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      process: result.process,
    });
  } catch (error) {
    console.error('Create approval process error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/approvals/processes
 * Update an approval process
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProcessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, ...updateData } = parsed.data;

    const result = await updateApprovalProcessRecord(id, updateData as Partial<CrmApprovalProcess>);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      process: result.process,
    });
  } catch (error) {
    console.error('Update approval process error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/approvals/processes
 * Delete an approval process
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const processId = searchParams.get('id');

    if (!processId) {
      return NextResponse.json({ error: 'Process ID required' }, { status: 400 });
    }

    const result = await deleteApprovalProcess(processId);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete approval process error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
