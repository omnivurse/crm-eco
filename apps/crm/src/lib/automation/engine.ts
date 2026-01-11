/**
 * CRM Automation Pack - Main Engine
 * Orchestrates workflow execution, logging, and safety controls
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CrmRecord } from '../crm/types';
import type {
  CrmWorkflow,
  AutomationContext,
  ExecuteWorkflowOptions,
  ExecuteAllWorkflowsOptions,
  AutomationRunResult,
  AutomationRunStatus,
  ActionResult,
  TriggerType,
  MAX_ACTIONS_PER_RUN,
} from './types';
import { evaluateConditions, shouldTriggerOnUpdate } from './conditions';
import { executeActions } from './actions';

// ============================================================================
// Supabase Client Helper
// ============================================================================

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
          } catch {
            // Server Component context
          }
        },
      },
    }
  );
}

// ============================================================================
// Run Logging
// ============================================================================

interface CreateRunInput {
  orgId: string;
  workflowId?: string;
  source: 'workflow' | 'assignment' | 'scoring' | 'cadence' | 'sla' | 'webform';
  trigger: string;
  moduleId?: string;
  recordId?: string;
  isDryRun: boolean;
  input: Record<string, unknown>;
  idempotencyKey?: string;
}

async function createAutomationRun(input: CreateRunInput): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_automation_runs')
    .insert({
      org_id: input.orgId,
      workflow_id: input.workflowId,
      source: input.source,
      trigger: input.trigger,
      module_id: input.moduleId,
      record_id: input.recordId,
      status: 'running',
      is_dry_run: input.isDryRun,
      input: input.input,
      idempotency_key: input.idempotencyKey,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create automation run:', error);
    throw error;
  }

  return data.id;
}

interface CompleteRunInput {
  runId: string;
  status: AutomationRunStatus;
  actionsExecuted: ActionResult[];
  output: Record<string, unknown>;
  error?: string;
}

async function completeAutomationRun(input: CompleteRunInput): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('crm_automation_runs')
    .update({
      status: input.status,
      actions_executed: input.actionsExecuted,
      output: input.output,
      error: input.error,
      completed_at: new Date().toISOString(),
    })
    .eq('id', input.runId);
}

// ============================================================================
// Idempotency Check
// ============================================================================

async function checkIdempotency(idempotencyKey: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('crm_automation_runs')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .limit(1);

  return (data?.length || 0) > 0;
}

// ============================================================================
// Workflow Fetching
// ============================================================================

async function getWorkflowById(workflowId: string): Promise<CrmWorkflow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_workflows')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (error) return null;
  return data as CrmWorkflow;
}

async function getEnabledWorkflows(
  orgId: string,
  moduleId: string,
  triggerType: TriggerType
): Promise<CrmWorkflow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_workflows')
    .select('*')
    .eq('org_id', orgId)
    .eq('module_id', moduleId)
    .eq('trigger_type', triggerType)
    .eq('is_enabled', true)
    .order('priority', { ascending: true });

  if (error) return [];
  return (data || []) as CrmWorkflow[];
}

// ============================================================================
// Main Engine Functions
// ============================================================================

/**
 * Execute a single workflow against a record
 */
export async function executeWorkflow(
  options: ExecuteWorkflowOptions
): Promise<AutomationRunResult> {
  const {
    workflowId,
    workflow: providedWorkflow,
    record,
    trigger,
    previousRecord,
    dryRun = false,
    idempotencyKey,
    userId,
    profileId,
  } = options;

  // Get workflow
  let workflow = providedWorkflow;
  if (!workflow && workflowId) {
    workflow = await getWorkflowById(workflowId);
  }

  if (!workflow) {
    return {
      runId: '',
      workflowId,
      status: 'failed',
      actionsExecuted: [],
      output: {},
      error: 'Workflow not found',
    };
  }

  // Check idempotency
  if (idempotencyKey && !dryRun) {
    const isDuplicate = await checkIdempotency(idempotencyKey);
    if (isDuplicate) {
      return {
        runId: '',
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: 'skipped',
        actionsExecuted: [],
        output: { reason: 'Duplicate request (idempotency)' },
      };
    }
  }

  // Check if workflow is enabled
  if (!workflow.is_enabled) {
    return {
      runId: '',
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'skipped',
      actionsExecuted: [],
      output: { reason: 'Workflow is disabled' },
    };
  }

  // Check trigger type match
  if (workflow.trigger_type !== trigger) {
    return {
      runId: '',
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'skipped',
      actionsExecuted: [],
      output: { reason: `Trigger mismatch: expected ${workflow.trigger_type}, got ${trigger}` },
    };
  }

  // For update triggers, check if watched fields changed
  if (trigger === 'on_update') {
    const shouldTrigger = shouldTriggerOnUpdate(
      workflow.trigger_config as Record<string, unknown>,
      record,
      previousRecord
    );
    if (!shouldTrigger) {
      return {
        runId: '',
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: 'skipped',
        actionsExecuted: [],
        output: { reason: 'No watched fields changed' },
      };
    }
  }

  // Evaluate conditions
  const conditionsMatch = evaluateConditions(
    workflow.conditions,
    record,
    previousRecord
  );

  if (!conditionsMatch) {
    return {
      runId: '',
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'skipped',
      actionsExecuted: [],
      output: { reason: 'Conditions not met' },
    };
  }

  // Create automation run record
  const runId = await createAutomationRun({
    orgId: record.org_id,
    workflowId: workflow.id,
    source: 'workflow',
    trigger,
    moduleId: record.module_id,
    recordId: record.id,
    isDryRun: dryRun,
    input: {
      record: { id: record.id, title: record.title },
      previousRecord: previousRecord ? { id: previousRecord.id, title: previousRecord.title } : null,
    },
    idempotencyKey,
  });

  // Build context
  const context: AutomationContext = {
    orgId: record.org_id,
    moduleId: record.module_id,
    record,
    previousRecord,
    trigger,
    dryRun,
    userId,
    profileId,
    idempotencyKey,
  };

  // Check action limit
  const maxActions = 50;
  const actions = workflow.actions.slice(0, maxActions);

  // Execute actions
  let actionsExecuted: ActionResult[] = [];
  let status: AutomationRunStatus = 'success';
  let error: string | undefined;

  try {
    actionsExecuted = await executeActions(
      actions,
      record,
      context,
      workflow.created_by
    );

    // Check for failures
    const hasFailure = actionsExecuted.some(a => a.status === 'failed');
    if (hasFailure) {
      status = 'failed';
      error = actionsExecuted.find(a => a.status === 'failed')?.error;
    } else if (dryRun) {
      status = 'dry_run';
    }
  } catch (e) {
    status = 'failed';
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  // Complete the run
  await completeAutomationRun({
    runId,
    status,
    actionsExecuted,
    output: {
      workflowName: workflow.name,
      actionsCount: actionsExecuted.length,
      successCount: actionsExecuted.filter(a => a.status === 'success').length,
      failedCount: actionsExecuted.filter(a => a.status === 'failed').length,
      skippedCount: actionsExecuted.filter(a => a.status === 'skipped').length,
    },
    error,
  });

  return {
    runId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status,
    actionsExecuted,
    output: {
      actionsCount: actionsExecuted.length,
    },
    error,
  };
}

/**
 * Execute all matching workflows for a record event
 */
export async function executeMatchingWorkflows(
  options: ExecuteAllWorkflowsOptions
): Promise<AutomationRunResult[]> {
  const {
    orgId,
    moduleId,
    record,
    trigger,
    previousRecord,
    dryRun = false,
    userId,
    profileId,
  } = options;

  // Get all enabled workflows for this module and trigger
  const workflows = await getEnabledWorkflows(orgId, moduleId, trigger);

  if (workflows.length === 0) {
    return [];
  }

  // Execute each workflow
  const results: AutomationRunResult[] = [];

  for (const workflow of workflows) {
    const result = await executeWorkflow({
      workflow,
      record,
      trigger,
      previousRecord,
      dryRun,
      userId,
      profileId,
    });

    results.push(result);

    // If a workflow failed and it wasn't a dry run, stop executing more workflows
    if (result.status === 'failed' && !dryRun) {
      break;
    }
  }

  return results;
}

/**
 * Test a workflow in dry run mode
 */
export async function testWorkflow(
  workflowId: string,
  recordId: string
): Promise<AutomationRunResult> {
  const supabase = await createClient();

  // Get workflow
  const workflow = await getWorkflowById(workflowId);
  if (!workflow) {
    return {
      runId: '',
      status: 'failed',
      actionsExecuted: [],
      output: {},
      error: 'Workflow not found',
    };
  }

  // Get record
  const { data: record, error } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (error || !record) {
    return {
      runId: '',
      workflowId,
      workflowName: workflow.name,
      status: 'failed',
      actionsExecuted: [],
      output: {},
      error: 'Record not found',
    };
  }

  return executeWorkflow({
    workflow,
    record: record as CrmRecord,
    trigger: workflow.trigger_type,
    dryRun: true,
  });
}

// ============================================================================
// Exports
// ============================================================================

export { createAutomationRun, completeAutomationRun };
