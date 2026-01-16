import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { executeWorkflow, getAutomationRunById, scheduleWorkflowRetry } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import type { CrmWorkflow, TriggerType } from '@/lib/automation/types';

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

/**
 * POST /api/automation/runs/[id]/retry
 * Retry a failed automation run
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the original run
    const originalRun = await getAutomationRunById(runId);
    if (!originalRun) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Verify org access
    if (originalRun.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Only retry failed runs
    if (originalRun.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed runs can be retried' },
        { status: 400 }
      );
    }

    // Check if we have the necessary information
    if (!originalRun.workflow_id || !originalRun.record_id) {
      return NextResponse.json(
        { error: 'Cannot retry: missing workflow or record reference' },
        { status: 400 }
      );
    }

    // Get the workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('crm_workflows')
      .select('*')
      .eq('id', originalRun.workflow_id)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found or has been deleted' },
        { status: 404 }
      );
    }

    // Get the record
    const { data: record, error: recordError } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', originalRun.record_id)
      .single();

    if (recordError || !record) {
      return NextResponse.json(
        { error: 'Record not found or has been deleted' },
        { status: 404 }
      );
    }

    // Check request body for scheduling option
    let scheduleForLater = false;
    let delaySeconds = 0;
    try {
      const body = await request.json();
      scheduleForLater = body.schedule === true;
      delaySeconds = body.delaySeconds || 0;
    } catch {
      // No body is fine
    }

    if (scheduleForLater) {
      // Schedule retry for later
      const jobId = await scheduleWorkflowRetry(
        profile.organization_id,
        runId,
        originalRun.record_id,
        originalRun.workflow_id,
        delaySeconds || 60
      );

      return NextResponse.json({
        success: true,
        scheduled: true,
        jobId,
        retryAt: new Date(Date.now() + (delaySeconds || 60) * 1000).toISOString(),
      });
    }

    // Execute immediately
    const result = await executeWorkflow({
      workflow: workflow as CrmWorkflow,
      record: record as CrmRecord,
      trigger: workflow.trigger_type as TriggerType,
      dryRun: false,
      userId: user.id,
      profileId: profile.id,
      idempotencyKey: `retry:${runId}:${Date.now()}`,
    });

    return NextResponse.json({
      success: result.status !== 'failed',
      originalRunId: runId,
      newRunId: result.runId,
      status: result.status,
      actionsExecuted: result.actionsExecuted.length,
      error: result.error,
    });
  } catch (error) {
    console.error('Failed to retry run:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
