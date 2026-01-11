/**
 * CRM Automation Pack - Cadence Engine
 * Processes cadence steps and manages enrollments
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CrmRecord, CrmTask } from '../crm/types';
import type {
  CrmCadence,
  CrmCadenceEnrollment,
  CadenceStep,
  CadenceTaskStep,
  CadenceEmailStep,
  CadenceCallStep,
  AutomationContext,
  ActionResult,
} from './types';
import { createAutomationRun, completeAutomationRun } from './engine';

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
// User Resolution
// ============================================================================

async function resolveAssignedTo(
  assignedTo: 'owner' | 'creator' | string | undefined,
  record: CrmRecord
): Promise<string | null> {
  if (!assignedTo || assignedTo === 'owner') {
    return record.owner_id || null;
  }
  if (assignedTo === 'creator') {
    return record.created_by || null;
  }
  return assignedTo;
}

// ============================================================================
// Step Executors
// ============================================================================

async function executeTaskStep(
  step: CadenceStep,
  config: CadenceTaskStep,
  record: CrmRecord,
  enrollment: CrmCadenceEnrollment
): Promise<ActionResult> {
  const supabase = await createClient();

  const assignedTo = await resolveAssignedTo(config.assignedTo, record);

  const { data: task, error } = await supabase
    .from('crm_tasks')
    .insert({
      org_id: enrollment.org_id,
      record_id: record.id,
      title: config.title,
      description: config.description,
      priority: config.priority || 'normal',
      assigned_to: assignedTo,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Due tomorrow
      created_by: enrollment.enrolled_by,
    })
    .select()
    .single();

  if (error) {
    return {
      actionId: step.id,
      type: 'create_task',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: step.id,
    type: 'create_task',
    status: 'success',
    output: { taskId: task.id },
  };
}

async function executeEmailStep(
  step: CadenceStep,
  config: CadenceEmailStep,
  record: CrmRecord,
  enrollment: CrmCadenceEnrollment
): Promise<ActionResult> {
  const supabase = await createClient();

  // For now, create an activity/note that an email should be sent
  // Real email sending would integrate with SendGrid/etc.
  const { data: note, error } = await supabase
    .from('crm_notes')
    .insert({
      org_id: enrollment.org_id,
      record_id: record.id,
      body: `[Cadence Email Step]\nSubject: ${config.subject || 'No subject'}\n\n${config.body || 'Email body would go here'}`,
      is_pinned: false,
      created_by: enrollment.enrolled_by,
    })
    .select()
    .single();

  // Also notify the owner
  if (record.owner_id) {
    await supabase
      .from('crm_notifications')
      .insert({
        org_id: enrollment.org_id,
        user_id: record.owner_id,
        title: 'Cadence Email Due',
        body: `Email step ready for ${record.title}: ${config.subject || 'No subject'}`,
        href: `/crm/r/${record.id}`,
        meta: {
          cadence_id: enrollment.cadence_id,
          step_id: step.id,
        },
      });
  }

  if (error) {
    return {
      actionId: step.id,
      type: 'add_note',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: step.id,
    type: 'add_note',
    status: 'success',
    output: { noteId: note.id, type: 'email_placeholder' },
  };
}

async function executeCallStep(
  step: CadenceStep,
  config: CadenceCallStep,
  record: CrmRecord,
  enrollment: CrmCadenceEnrollment
): Promise<ActionResult> {
  const supabase = await createClient();

  const assignedTo = await resolveAssignedTo(config.assignedTo, record);

  // Create a call task
  const { data: task, error } = await supabase
    .from('crm_tasks')
    .insert({
      org_id: enrollment.org_id,
      record_id: record.id,
      title: `Call: ${record.title}`,
      description: config.script || 'Make a follow-up call',
      priority: 'high',
      assigned_to: assignedTo,
      due_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // Due in 4 hours
      created_by: enrollment.enrolled_by,
    })
    .select()
    .single();

  if (error) {
    return {
      actionId: step.id,
      type: 'create_task',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: step.id,
    type: 'create_task',
    status: 'success',
    output: { taskId: task.id, type: 'call' },
  };
}

// ============================================================================
// Main Cadence Processing
// ============================================================================

/**
 * Process a single cadence step for an enrollment
 */
async function processEnrollmentStep(
  enrollment: CrmCadenceEnrollment,
  cadence: CrmCadence,
  record: CrmRecord
): Promise<{ success: boolean; result?: ActionResult; error?: string }> {
  const currentStep = enrollment.current_step;
  const steps = cadence.steps;

  if (currentStep >= steps.length) {
    return { success: true, result: undefined }; // Cadence complete
  }

  const step = steps[currentStep];
  let result: ActionResult;

  try {
    switch (step.type) {
      case 'task':
        result = await executeTaskStep(step, step.config as CadenceTaskStep, record, enrollment);
        break;

      case 'email':
        result = await executeEmailStep(step, step.config as CadenceEmailStep, record, enrollment);
        break;

      case 'call':
        result = await executeCallStep(step, step.config as CadenceCallStep, record, enrollment);
        break;

      case 'wait':
        // Wait steps don't execute anything, just advance
        result = {
          actionId: step.id,
          type: 'update_fields',
          status: 'success',
          output: { waited: true },
        };
        break;

      default:
        return {
          success: false,
          error: `Unknown step type: ${step.type}`,
        };
    }

    return { success: result.status === 'success', result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Advance an enrollment to the next step
 */
async function advanceEnrollment(
  enrollment: CrmCadenceEnrollment,
  cadence: CrmCadence
): Promise<void> {
  const supabase = await createClient();

  const nextStepIndex = enrollment.current_step + 1;
  const steps = cadence.steps;

  if (nextStepIndex >= steps.length) {
    // Cadence complete
    await supabase
      .from('crm_cadence_enrollments')
      .update({
        status: 'completed',
        current_step: nextStepIndex,
        next_step_at: null,
      })
      .eq('id', enrollment.id);
  } else {
    // Calculate next step time
    const nextStep = steps[nextStepIndex];
    const delayDays = nextStep.delayDays || 0;
    const nextStepAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('crm_cadence_enrollments')
      .update({
        current_step: nextStepIndex,
        next_step_at: nextStepAt,
      })
      .eq('id', enrollment.id);
  }
}

/**
 * Process all pending cadence steps (called by cron)
 */
export async function processPendingCadenceSteps(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const supabase = await createClient();

  // Get enrollments where next_step_at is due
  const { data: enrollments, error } = await supabase
    .from('crm_cadence_enrollments')
    .select('*')
    .eq('status', 'active')
    .lte('next_step_at', new Date().toISOString())
    .order('next_step_at', { ascending: true })
    .limit(100); // Process in batches

  if (error || !enrollments || enrollments.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const enrollment of enrollments) {
    const typedEnrollment = enrollment as CrmCadenceEnrollment;

    // Get the cadence
    const { data: cadence } = await supabase
      .from('crm_cadences')
      .select('*')
      .eq('id', typedEnrollment.cadence_id)
      .single();

    if (!cadence || !cadence.is_enabled) {
      // Cadence disabled or deleted, cancel enrollment
      await supabase
        .from('crm_cadence_enrollments')
        .update({ status: 'cancelled' })
        .eq('id', typedEnrollment.id);
      continue;
    }

    // Get the record
    const { data: record } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', typedEnrollment.record_id)
      .single();

    if (!record) {
      // Record deleted, cancel enrollment
      await supabase
        .from('crm_cadence_enrollments')
        .update({ status: 'cancelled' })
        .eq('id', typedEnrollment.id);
      continue;
    }

    // Create automation run
    const runId = await createAutomationRun({
      orgId: typedEnrollment.org_id,
      source: 'cadence',
      trigger: 'scheduled',
      moduleId: record.module_id,
      recordId: record.id,
      isDryRun: false,
      input: {
        cadenceId: typedEnrollment.cadence_id,
        enrollmentId: typedEnrollment.id,
        currentStep: typedEnrollment.current_step,
      },
    });

    // Process the step
    const result = await processEnrollmentStep(
      typedEnrollment,
      cadence as CrmCadence,
      record as CrmRecord
    );

    processed++;

    if (result.success) {
      succeeded++;
      await advanceEnrollment(typedEnrollment, cadence as CrmCadence);

      await completeAutomationRun({
        runId,
        status: 'success',
        actionsExecuted: result.result ? [result.result] : [],
        output: {
          stepped: true,
          fromStep: typedEnrollment.current_step,
          toStep: typedEnrollment.current_step + 1,
        },
      });
    } else {
      failed++;

      await completeAutomationRun({
        runId,
        status: 'failed',
        actionsExecuted: result.result ? [result.result] : [],
        output: {},
        error: result.error,
      });
    }
  }

  return { processed, succeeded, failed };
}

// ============================================================================
// Enrollment Management
// ============================================================================

/**
 * Enroll a record in a cadence
 */
export async function enrollInCadence(
  recordId: string,
  cadenceId: string,
  enrolledBy?: string
): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  const supabase = await createClient();

  // Get the cadence
  const { data: cadence } = await supabase
    .from('crm_cadences')
    .select('*')
    .eq('id', cadenceId)
    .single();

  if (!cadence || !cadence.is_enabled) {
    return { success: false, error: 'Cadence not found or disabled' };
  }

  // Get the record
  const { data: record } = await supabase
    .from('crm_records')
    .select('org_id')
    .eq('id', recordId)
    .single();

  if (!record) {
    return { success: false, error: 'Record not found' };
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('crm_cadence_enrollments')
    .select('id, status')
    .eq('cadence_id', cadenceId)
    .eq('record_id', recordId)
    .single();

  const steps = cadence.steps as CadenceStep[];
  const firstStepDelay = steps[0]?.delayDays || 0;
  const nextStepAt = new Date(Date.now() + firstStepDelay * 24 * 60 * 60 * 1000).toISOString();

  if (existing) {
    if (existing.status === 'active') {
      return { success: false, error: 'Already enrolled in this cadence' };
    }

    // Reactivate
    const { error } = await supabase
      .from('crm_cadence_enrollments')
      .update({
        status: 'active',
        current_step: 0,
        next_step_at: nextStepAt,
        enrolled_by: enrolledBy,
      })
      .eq('id', existing.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, enrollmentId: existing.id };
  }

  // Create new enrollment
  const { data: enrollment, error } = await supabase
    .from('crm_cadence_enrollments')
    .insert({
      org_id: record.org_id,
      cadence_id: cadenceId,
      record_id: recordId,
      status: 'active',
      current_step: 0,
      next_step_at: nextStepAt,
      enrolled_by: enrolledBy,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, enrollmentId: enrollment.id };
}

/**
 * Unenroll a record from a cadence
 */
export async function unenrollFromCadence(
  recordId: string,
  cadenceId?: string
): Promise<{ success: boolean; count: number }> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_cadence_enrollments')
    .update({ status: 'cancelled' })
    .eq('record_id', recordId)
    .eq('status', 'active');

  if (cadenceId) {
    query = query.eq('cadence_id', cadenceId);
  }

  const { error, count } = await query;

  if (error) {
    return { success: false, count: 0 };
  }

  return { success: true, count: count || 0 };
}

/**
 * Pause an enrollment
 */
export async function pauseEnrollment(
  enrollmentId: string
): Promise<{ success: boolean }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_cadence_enrollments')
    .update({ status: 'paused' })
    .eq('id', enrollmentId)
    .eq('status', 'active');

  return { success: !error };
}

/**
 * Resume a paused enrollment
 */
export async function resumeEnrollment(
  enrollmentId: string
): Promise<{ success: boolean }> {
  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from('crm_cadence_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .eq('status', 'paused')
    .single();

  if (!enrollment) {
    return { success: false };
  }

  // Recalculate next step time from now
  const { data: cadence } = await supabase
    .from('crm_cadences')
    .select('steps')
    .eq('id', enrollment.cadence_id)
    .single();

  if (!cadence) {
    return { success: false };
  }

  const steps = cadence.steps as CadenceStep[];
  const currentStep = enrollment.current_step;
  
  if (currentStep >= steps.length) {
    // Already at end, mark complete
    await supabase
      .from('crm_cadence_enrollments')
      .update({ status: 'completed' })
      .eq('id', enrollmentId);
    return { success: true };
  }

  const nextStepDelay = steps[currentStep]?.delayDays || 0;
  const nextStepAt = new Date(Date.now() + nextStepDelay * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('crm_cadence_enrollments')
    .update({
      status: 'active',
      next_step_at: nextStepAt,
    })
    .eq('id', enrollmentId);

  return { success: !error };
}

/**
 * Get enrollments for a record
 */
export async function getRecordEnrollments(
  recordId: string
): Promise<CrmCadenceEnrollment[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('crm_cadence_enrollments')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  return (data || []) as CrmCadenceEnrollment[];
}
