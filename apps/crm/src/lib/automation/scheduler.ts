/**
 * CRM Automation Pack - Scheduler
 * Handles delayed workflow steps, scheduled workflows, and retries
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CrmRecord } from '../crm/types';
import type {
  CrmSchedulerJob,
  SchedulerJobType,
  SchedulerJobStatus,
  CrmWorkflow,
  TriggerType,
} from './types';
import { executeWorkflow, executeMatchingWorkflows } from './engine';

// ============================================================================
// Supabase Client Helpers
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

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}

// ============================================================================
// Job Scheduling Functions
// ============================================================================

export interface ScheduleJobInput {
  orgId: string;
  jobType: SchedulerJobType;
  entityType: string;
  entityId: string;
  recordId?: string;
  runAt: Date;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  idempotencyKey?: string;
}

/**
 * Schedule a new job for future execution
 */
export async function scheduleJob(input: ScheduleJobInput): Promise<string> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('crm_scheduler_jobs')
    .insert({
      org_id: input.orgId,
      job_type: input.jobType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      record_id: input.recordId,
      run_at: input.runAt.toISOString(),
      status: 'pending',
      max_attempts: input.maxAttempts || 3,
      payload: input.payload || {},
      idempotency_key: input.idempotencyKey,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to schedule job:', error);
    throw error;
  }

  return data.id;
}

/**
 * Schedule a delayed workflow step
 */
export async function scheduleWorkflowStep(
  orgId: string,
  runId: string,
  stepId: string,
  recordId: string,
  delaySeconds: number,
  payload?: Record<string, unknown>
): Promise<string> {
  const runAt = new Date(Date.now() + delaySeconds * 1000);
  
  return scheduleJob({
    orgId,
    jobType: 'workflow_step',
    entityType: 'step',
    entityId: stepId,
    recordId,
    runAt,
    payload: {
      runId,
      stepId,
      recordId,
      ...payload,
    },
    idempotencyKey: `step:${runId}:${stepId}`,
  });
}

/**
 * Schedule a workflow run retry
 */
export async function scheduleWorkflowRetry(
  orgId: string,
  runId: string,
  recordId: string,
  workflowId: string,
  retryDelaySeconds: number = 60
): Promise<string> {
  const runAt = new Date(Date.now() + retryDelaySeconds * 1000);
  
  return scheduleJob({
    orgId,
    jobType: 'retry',
    entityType: 'run',
    entityId: runId,
    recordId,
    runAt,
    payload: {
      runId,
      workflowId,
      recordId,
    },
    maxAttempts: 3,
  });
}

/**
 * Schedule a workflow to run at a specific time (for cron-like scheduling)
 */
export async function scheduleWorkflowExecution(
  orgId: string,
  workflowId: string,
  runAt: Date,
  payload?: Record<string, unknown>
): Promise<string> {
  return scheduleJob({
    orgId,
    jobType: 'scheduled_workflow',
    entityType: 'workflow',
    entityId: workflowId,
    runAt,
    payload: {
      workflowId,
      ...payload,
    },
    idempotencyKey: `scheduled:${workflowId}:${runAt.toISOString()}`,
  });
}

// ============================================================================
// Job Processing Functions
// ============================================================================

interface ProcessJobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'retrying';
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Process a single scheduler job
 */
async function processJob(job: CrmSchedulerJob): Promise<ProcessJobResult> {
  const supabase = createServiceClient();

  try {
    // Mark job as processing
    await supabase.rpc('claim_scheduler_job', { p_job_id: job.id });

    let result: Record<string, unknown> = {};

    switch (job.job_type) {
      case 'workflow_step':
        result = await processWorkflowStepJob(job);
        break;

      case 'scheduled_workflow':
        result = await processScheduledWorkflowJob(job);
        break;

      case 'retry':
        result = await processRetryJob(job);
        break;

      case 'cadence_step':
        // Cadence steps are handled by the cadence processor
        result = { skipped: true, reason: 'Handled by cadence processor' };
        break;

      case 'sla_escalation':
        result = await processSlaEscalationJob(job);
        break;

      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // Mark job as completed
    await supabase.rpc('complete_scheduler_job', {
      p_job_id: job.id,
      p_status: 'completed',
      p_result: result,
    });

    return {
      jobId: job.id,
      status: 'completed',
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if we should retry
    if (job.attempts < job.max_attempts) {
      await supabase
        .from('crm_scheduler_jobs')
        .update({
          status: 'pending',
          last_error: errorMessage,
          run_at: new Date(Date.now() + 60000 * Math.pow(2, job.attempts)).toISOString(), // Exponential backoff
        })
        .eq('id', job.id);

      return {
        jobId: job.id,
        status: 'retrying',
        error: errorMessage,
      };
    }

    // Mark as failed
    await supabase.rpc('complete_scheduler_job', {
      p_job_id: job.id,
      p_status: 'failed',
      p_error: errorMessage,
    });

    return {
      jobId: job.id,
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Process a delayed workflow step
 */
async function processWorkflowStepJob(job: CrmSchedulerJob): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const { runId, stepId, recordId } = job.payload as { runId: string; stepId: string; recordId: string };

  // Get the record
  const { data: record, error: recordError } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (recordError || !record) {
    return { error: 'Record not found', recordId };
  }

  // Get the workflow step
  const { data: step, error: stepError } = await supabase
    .from('crm_workflow_steps')
    .select('*, workflow:crm_workflows(*)')
    .eq('id', stepId)
    .single();

  if (stepError || !step) {
    return { error: 'Step not found', stepId };
  }

  // Execute the step's action
  const { executeAction } = await import('./actions');
  const { evaluateConditions } = await import('./conditions');

  // Check step-level conditions
  if (step.conditions && Array.isArray(step.conditions) && step.conditions.length > 0) {
    const conditionsMatch = evaluateConditions(step.conditions, record as CrmRecord);
    if (!conditionsMatch) {
      return { skipped: true, reason: 'Step conditions not met' };
    }
  }

  const action = {
    id: step.id,
    type: step.action_type,
    config: step.action_config,
    order: step.step_order,
  };

  const context = {
    orgId: job.org_id,
    moduleId: record.module_id,
    record: record as CrmRecord,
    trigger: step.workflow?.trigger_type || 'scheduled',
    dryRun: false,
  };

  const result = await executeAction(action, record as CrmRecord, context);

  // Log the step execution
  await supabase
    .from('crm_workflow_run_logs')
    .insert({
      run_id: runId,
      step_id: stepId,
      step_order: step.step_order,
      action_type: step.action_type,
      status: result.status,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      output: result.output || {},
      error: result.error,
    });

  return {
    stepId,
    actionType: step.action_type,
    result,
  };
}

/**
 * Process a scheduled workflow execution
 */
async function processScheduledWorkflowJob(job: CrmSchedulerJob): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const { workflowId } = job.payload as { workflowId: string };

  // Get the workflow
  const { data: workflow, error: workflowError } = await supabase
    .from('crm_workflows')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (workflowError || !workflow) {
    return { error: 'Workflow not found', workflowId };
  }

  if (!workflow.is_enabled) {
    return { skipped: true, reason: 'Workflow is disabled' };
  }

  // For scheduled workflows, we need to find matching records based on workflow conditions
  // and execute the workflow for each matching record
  const { data: records, error: recordsError } = await supabase
    .from('crm_records')
    .select('*')
    .eq('module_id', workflow.module_id)
    .limit(100); // Process in batches

  if (recordsError) {
    return { error: 'Failed to fetch records', message: recordsError.message };
  }

  const { evaluateConditions } = await import('./conditions');
  const results: { recordId: string; status: string }[] = [];

  for (const record of records || []) {
    // Check workflow conditions
    const conditionsMatch = evaluateConditions(workflow.conditions, record as CrmRecord);
    if (!conditionsMatch) continue;

    // Execute workflow for this record
    const result = await executeWorkflow({
      workflow: workflow as CrmWorkflow,
      record: record as CrmRecord,
      trigger: 'scheduled',
      dryRun: false,
    });

    results.push({
      recordId: record.id,
      status: result.status,
    });
  }

  return {
    workflowId,
    recordsProcessed: results.length,
    results,
  };
}

/**
 * Process a workflow retry
 */
async function processRetryJob(job: CrmSchedulerJob): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const { runId, workflowId, recordId } = job.payload as { 
    runId: string; 
    workflowId: string; 
    recordId: string;
  };

  // Get the original run
  const { data: originalRun } = await supabase
    .from('crm_automation_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (!originalRun) {
    return { error: 'Original run not found', runId };
  }

  // Get the workflow
  const { data: workflow } = await supabase
    .from('crm_workflows')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (!workflow || !workflow.is_enabled) {
    return { skipped: true, reason: 'Workflow not found or disabled' };
  }

  // Get the record
  const { data: record } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (!record) {
    return { error: 'Record not found', recordId };
  }

  // Re-execute the workflow
  const result = await executeWorkflow({
    workflow: workflow as CrmWorkflow,
    record: record as CrmRecord,
    trigger: workflow.trigger_type,
    dryRun: false,
    idempotencyKey: `retry:${runId}:${Date.now()}`,
  });

  return {
    originalRunId: runId,
    newRunId: result.runId,
    status: result.status,
  };
}

/**
 * Process an SLA escalation
 */
async function processSlaEscalationJob(job: CrmSchedulerJob): Promise<Record<string, unknown>> {
  // SLA escalation logic would go here
  // For now, return a placeholder
  return {
    type: 'sla_escalation',
    status: 'processed',
    entityId: job.entity_id,
  };
}

// ============================================================================
// Main Processing Functions
// ============================================================================

export interface ProcessJobsResult {
  processed: number;
  completed: number;
  failed: number;
  retrying: number;
  results: ProcessJobResult[];
}

/**
 * Process all pending scheduler jobs
 */
export async function processScheduledJobs(
  limit: number = 100,
  jobTypes?: SchedulerJobType[]
): Promise<ProcessJobsResult> {
  const supabase = createServiceClient();

  // Get pending jobs using the helper function
  const { data: jobs, error } = await supabase
    .rpc('get_pending_scheduler_jobs', {
      p_limit: limit,
      p_job_types: jobTypes || null,
    });

  if (error) {
    console.error('Failed to fetch pending jobs:', error);
    return {
      processed: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      results: [],
    };
  }

  const results: ProcessJobResult[] = [];
  let completed = 0;
  let failed = 0;
  let retrying = 0;

  for (const job of jobs || []) {
    const result = await processJob(job as CrmSchedulerJob);
    results.push(result);

    switch (result.status) {
      case 'completed':
        completed++;
        break;
      case 'failed':
        failed++;
        break;
      case 'retrying':
        retrying++;
        break;
    }
  }

  return {
    processed: results.length,
    completed,
    failed,
    retrying,
    results,
  };
}

/**
 * Process scheduled workflows (cron-like execution)
 * This should be called periodically to check for workflows with scheduled triggers
 */
export async function processScheduledWorkflows(): Promise<{
  workflowsChecked: number;
  workflowsTriggered: number;
}> {
  const supabase = createServiceClient();

  // Get all enabled scheduled workflows
  const { data: workflows, error } = await supabase
    .from('crm_workflows')
    .select('*')
    .eq('trigger_type', 'scheduled')
    .eq('is_enabled', true);

  if (error || !workflows) {
    console.error('Failed to fetch scheduled workflows:', error);
    return { workflowsChecked: 0, workflowsTriggered: 0 };
  }

  let triggered = 0;

  for (const workflow of workflows) {
    const triggerConfig = workflow.trigger_config as { cron?: string; lastRun?: string };
    
    // Simple check: if cron is set and it's been more than 1 hour since last run
    // In a real implementation, you'd parse the cron expression
    if (triggerConfig.cron) {
      const lastRun = triggerConfig.lastRun ? new Date(triggerConfig.lastRun) : null;
      const now = new Date();
      
      // Check if it's time to run (simple hourly check for now)
      const shouldRun = !lastRun || (now.getTime() - lastRun.getTime() > 3600000);
      
      if (shouldRun) {
        // Schedule for immediate execution
        await scheduleWorkflowExecution(
          workflow.org_id,
          workflow.id,
          now,
          { scheduledRun: true }
        );
        
        // Update last run time
        await supabase
          .from('crm_workflows')
          .update({
            trigger_config: { ...triggerConfig, lastRun: now.toISOString() },
          })
          .eq('id', workflow.id);
        
        triggered++;
      }
    }
  }

  return {
    workflowsChecked: workflows.length,
    workflowsTriggered: triggered,
  };
}

/**
 * Cancel a pending scheduler job
 */
export async function cancelSchedulerJob(jobId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('crm_scheduler_jobs')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'pending');

  return !error;
}

/**
 * Get pending jobs for a specific entity
 */
export async function getPendingJobsForEntity(
  entityType: string,
  entityId: string
): Promise<CrmSchedulerJob[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('crm_scheduler_jobs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('status', 'pending')
    .order('run_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch pending jobs:', error);
    return [];
  }

  return (data || []) as CrmSchedulerJob[];
}
