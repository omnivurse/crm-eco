import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  getApprovalRulesForModule,
  createApprovalRule,
  updateApprovalRule,
  deleteApprovalRule,
} from '@/lib/approvals';

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

const createRuleSchema = z.object({
  module_id: z.string().uuid(),
  process_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  trigger_type: z.enum(['field_change', 'stage_transition', 'record_delete', 'record_create', 'field_threshold']),
  trigger_config: z.object({
    field: z.string().optional(),
    stage_from: z.string().optional(),
    stage_to: z.string().optional(),
    threshold: z.number().optional(),
  }).optional(),
  conditions: z.object({
    logic: z.enum(['AND', 'OR']),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in', 'not_in', 'is_empty', 'is_not_empty']),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
    })),
  }).optional(),
  priority: z.number().optional(),
  is_enabled: z.boolean().optional(),
});

const updateRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  trigger_type: z.enum(['field_change', 'stage_transition', 'record_delete', 'record_create', 'field_threshold']).optional(),
  trigger_config: z.object({
    field: z.string().optional(),
    stage_from: z.string().optional(),
    stage_to: z.string().optional(),
    threshold: z.number().optional(),
  }).optional(),
  conditions: z.object({
    logic: z.enum(['AND', 'OR']),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in', 'not_in', 'is_empty', 'is_not_empty']),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
    })),
  }).optional(),
  priority: z.number().optional(),
  is_enabled: z.boolean().optional(),
});

/**
 * GET /api/approvals/rules
 * Get approval rules for a module
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
    const triggerType = searchParams.get('triggerType');

    if (!moduleId) {
      // Get all rules for the organization
      const { data: rules } = await supabase
        .from('crm_approval_rules')
        .select(`
          *,
          process:crm_approval_processes(name),
          module:crm_modules(name, key)
        `)
        .eq('org_id', profile.organization_id)
        .order('priority');

      return NextResponse.json({ rules: rules || [] });
    }

    const rules = await getApprovalRulesForModule(
      moduleId,
      triggerType as 'field_change' | 'stage_transition' | 'record_delete' | 'record_create' | 'field_threshold' | undefined
    );

    // Filter to org
    const orgRules = rules.filter(r => r.org_id === profile.organization_id);

    return NextResponse.json({ rules: orgRules });
  } catch (error) {
    console.error('Get approval rules error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals/rules
 * Create a new approval rule
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);

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

    const result = await createApprovalRule({
      org_id: profile.organization_id,
      module_id: parsed.data.module_id,
      process_id: parsed.data.process_id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      trigger_type: parsed.data.trigger_type,
      trigger_config: parsed.data.trigger_config || {},
      conditions: parsed.data.conditions || { logic: 'AND', conditions: [] },
      priority: parsed.data.priority ?? 100,
      is_enabled: parsed.data.is_enabled ?? true,
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
      rule: result.rule,
    });
  } catch (error) {
    console.error('Create approval rule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/approvals/rules
 * Update an approval rule
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateRuleSchema.safeParse(body);

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

    const result = await updateApprovalRule(id, updateData);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      rule: result.rule,
    });
  } catch (error) {
    console.error('Update approval rule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/approvals/rules
 * Delete an approval rule
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
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    const result = await deleteApprovalRule(ruleId);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete approval rule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
