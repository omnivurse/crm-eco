import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createApprovalRequest, checkApprovalRequired } from '@/lib/approvals';
import type { ApprovalActionPayload, ApprovalContext } from '@/lib/approvals/types';

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

const fieldChangeSchema = z.object({
  old: z.unknown(),
  new: z.unknown(),
}).required();

const createApprovalRequestSchema = z.object({
  recordId: z.string().uuid(),
  moduleId: z.string().uuid(),
  processId: z.string().uuid().optional(),
  ruleId: z.string().uuid().optional(),
  triggerType: z.enum(['field_change', 'stage_transition', 'record_delete', 'record_create', 'field_threshold']),
  actionPayload: z.object({
    type: z.enum(['update', 'delete', 'stage_change', 'field_update']),
    record_id: z.string().uuid(),
    module_id: z.string().uuid(),
    data: z.record(z.unknown()).optional(),
    stage_from: z.string().nullable().optional(),
    stage_to: z.string().optional(),
    field_changes: z.record(fieldChangeSchema).optional(),
  }),
  context: z.object({
    action_type: z.string(),
    blueprint_id: z.string().optional(),
    stage_from: z.string().nullable().optional(),
    stage_to: z.string().optional(),
    field_changes: z.record(fieldChangeSchema).optional(),
  }).passthrough(),
});

/**
 * POST /api/approvals/request
 * Create a new approval request
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createApprovalRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { recordId, moduleId, processId, ruleId, triggerType, actionPayload, context } = parsed.data;

    // If no processId provided, check rules to find matching process
    let finalProcessId = processId;
    let finalRuleId = ruleId;

    if (!finalProcessId) {
      // Get record data for rule evaluation
      const { data: record } = await supabase
        .from('crm_records')
        .select('data, stage')
        .eq('id', recordId)
        .single();

      const recordData = {
        ...(record?.data || {}),
        stage: record?.stage,
      };

      const ruleMatch = await checkApprovalRequired(
        profile.organization_id,
        moduleId,
        triggerType,
        recordData,
        {
          stage_from: context.stage_from,
          stage_to: context.stage_to,
        }
      );

      if (!ruleMatch) {
        return NextResponse.json({
          success: false,
          error: 'No approval rule matches this action',
          requiresApproval: false,
        });
      }

      finalProcessId = ruleMatch.processId;
      finalRuleId = ruleMatch.ruleId;
    }

    // Create the approval request
    const result = await createApprovalRequest({
      orgId: profile.organization_id,
      moduleId,
      recordId,
      processId: finalProcessId,
      ruleId: finalRuleId,
      triggerType,
      actionPayload: actionPayload as ApprovalActionPayload,
      context: context as ApprovalContext,
      requestedBy: profile.id,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      approvalId: result.approvalId,
      requiresApproval: true,
    });
  } catch (error) {
    console.error('Create approval request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
