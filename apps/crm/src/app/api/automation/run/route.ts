import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { executeWorkflow, testWorkflow } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';

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

const runWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  recordId: z.string().uuid(),
  dryRun: z.boolean().optional().default(false),
});

/**
 * POST /api/automation/run
 * Manually trigger a workflow against a record
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = runWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { workflowId, recordId, dryRun } = parsed.data;

    // Get user profile and verify permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden: Admin or Manager role required' }, { status: 403 });
    }

    // Get the workflow to verify access
    const { data: workflow, error: workflowError } = await supabase
      .from('crm_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Verify org access
    if (workflow.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get the record
    const { data: record, error: recordError } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (recordError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Verify record belongs to same org
    if (record.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Execute the workflow
    const result = await executeWorkflow({
      workflow,
      record: record as CrmRecord,
      trigger: workflow.trigger_type,
      dryRun,
      userId: user.id,
      profileId: profile.id,
    });

    return NextResponse.json({
      success: result.status !== 'failed',
      result,
    });
  } catch (error) {
    console.error('Automation run error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automation/run?workflowId=xxx&recordId=xxx
 * Test a workflow in dry-run mode
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const recordId = searchParams.get('recordId');

    if (!workflowId || !recordId) {
      return NextResponse.json(
        { error: 'Missing workflowId or recordId' },
        { status: 400 }
      );
    }

    // Get user profile and verify permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Test the workflow
    const result = await testWorkflow(workflowId, recordId);

    return NextResponse.json({
      success: result.status !== 'failed',
      result,
    });
  } catch (error) {
    console.error('Automation test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
