import { createClient } from '@supabase/supabase-js';
import type { SequenceStep, EnrollmentStatus } from './types';

// Create admin client for background processing
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface Enrollment {
  id: string;
  sequence_id: string;
  record_id: string;
  module_key: string;
  email: string;
  current_step_id: string | null;
  current_step_order: number;
  status: EnrollmentStatus;
  enrolled_at: string;
  next_step_at: string | null;
}

interface EmailSequence {
  id: string;
  org_id: string;
  name: string;
  status: string;
  exit_conditions: ExitCondition[] | null;
  settings: SequenceSettings | null;
}

interface ExitCondition {
  type: 'reply_received' | 'tag_added' | 'field_changed' | 'unsubscribed' | 'bounced';
  tag?: string;
  field?: string;
  value?: string;
}

interface SequenceSettings {
  skip_weekends?: boolean;
  skip_holidays?: boolean;
  timezone?: string;
  throttle_daily?: number;
  stop_on_reply?: boolean;
  stop_on_bounce?: boolean;
}

/**
 * Process all pending enrollment steps that are due
 * This should be called by a cron job or background worker
 */
export async function processEnrollments() {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Get all enrollments that are due for processing
  const { data: dueEnrollments, error } = await supabase
    .from('email_sequence_enrollments')
    .select(`
      *,
      sequence:email_sequences(*),
      current_step:email_sequence_steps(*)
    `)
    .eq('status', 'active')
    .lte('next_step_at', now)
    .limit(100); // Process in batches

  if (error) {
    console.error('Error fetching due enrollments:', error);
    return { processed: 0, errors: 1 };
  }

  if (!dueEnrollments || dueEnrollments.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  for (const enrollment of dueEnrollments) {
    try {
      await processEnrollmentStep(supabase, enrollment);
      processed++;
    } catch (err) {
      console.error(`Error processing enrollment ${enrollment.id}:`, err);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Process a single enrollment step
 */
async function processEnrollmentStep(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: Enrollment & {
    sequence: EmailSequence;
    current_step: SequenceStep | null;
  }
) {
  // Check if sequence is still active
  if (enrollment.sequence.status !== 'active') {
    await pauseEnrollment(supabase, enrollment.id, 'Sequence paused');
    return;
  }

  // Check exit conditions
  const exitReason = await checkExitConditions(supabase, enrollment);
  if (exitReason) {
    await exitEnrollment(supabase, enrollment.id, exitReason);
    return;
  }

  const currentStep = enrollment.current_step;
  if (!currentStep) {
    await exitEnrollment(supabase, enrollment.id, 'No current step');
    return;
  }

  // Execute the step based on type
  switch (currentStep.step_type) {
    case 'email':
      await executeEmailStep(supabase, enrollment, currentStep);
      break;
    case 'wait':
      // Wait steps just advance to next step
      break;
    case 'condition':
      await evaluateCondition(supabase, enrollment, currentStep);
      break;
  }

  // Advance to next step
  await advanceToNextStep(supabase, enrollment);
}

/**
 * Execute an email step
 */
async function executeEmailStep(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: Enrollment & { sequence: EmailSequence },
  step: SequenceStep
) {
  // Get record data for merge fields
  const { data: record } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', enrollment.record_id)
    .single();

  if (!record) {
    throw new Error('Record not found');
  }

  // Process merge fields in subject and body
  const mergeData = {
    contact: {
      first_name: record.data?.first_name || '',
      last_name: record.data?.last_name || '',
      email: enrollment.email,
      company: record.data?.company || '',
      ...record.data,
    },
  };

  const subject = processMergeFields(step.subject || '', mergeData);
  const bodyHtml = processMergeFields(step.body_html || '', mergeData);
  const bodyText = processMergeFields(step.body_text || '', mergeData);

  // Create email send record
  const { data: emailSend, error: sendError } = await supabase
    .from('email_campaign_recipients')
    .insert({
      campaign_id: null, // Not part of a campaign
      record_id: enrollment.record_id,
      module_key: enrollment.module_key,
      email: enrollment.email,
      first_name: record.data?.first_name,
      last_name: record.data?.last_name,
      status: 'pending',
    })
    .select()
    .single();

  if (sendError) {
    console.error('Error creating email send record:', sendError);
  }

  // Queue email for sending (actual sending handled by email service)
  await supabase.from('email_queue').insert({
    org_id: enrollment.sequence.org_id,
    recipient_email: enrollment.email,
    recipient_name: `${record.data?.first_name || ''} ${record.data?.last_name || ''}`.trim(),
    from_email: step.from_email,
    from_name: step.from_name,
    subject,
    body_html: bodyHtml,
    body_text: bodyText,
    sequence_id: enrollment.sequence_id,
    enrollment_id: enrollment.id,
    step_id: step.id,
    record_id: enrollment.record_id,
    status: 'queued',
  });

  // Log the step execution
  await supabase.from('email_sequence_step_executions').insert({
    enrollment_id: enrollment.id,
    step_id: step.id,
    executed_at: new Date().toISOString(),
    status: 'executed',
  });
}

/**
 * Evaluate a condition step
 */
async function evaluateCondition(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: Enrollment,
  step: SequenceStep
) {
  const config = step.condition_config as {
    type: string;
    field?: string;
    operator?: string;
    value?: unknown;
    then_step_id?: string;
    else_step_id?: string;
  } | null;

  if (!config) {
    return;
  }

  let conditionMet = false;

  switch (config.type) {
    case 'email_opened':
      // Check if previous email was opened
      const { data: openEvent } = await supabase
        .from('email_tracking_events')
        .select('id')
        .eq('enrollment_id', enrollment.id)
        .eq('event_type', 'open')
        .limit(1)
        .single();
      conditionMet = !!openEvent;
      break;

    case 'link_clicked':
      // Check if any link was clicked
      const { data: clickEvent } = await supabase
        .from('email_tracking_events')
        .select('id')
        .eq('enrollment_id', enrollment.id)
        .eq('event_type', 'click')
        .limit(1)
        .single();
      conditionMet = !!clickEvent;
      break;

    case 'field_value':
      // Check record field value
      const { data: record } = await supabase
        .from('crm_records')
        .select('data')
        .eq('id', enrollment.record_id)
        .single();

      if (record && config.field) {
        const fieldValue = record.data?.[config.field];
        conditionMet = evaluateFieldCondition(fieldValue, config.operator || 'equals', config.value);
      }
      break;
  }

  // Store the condition result for routing
  await supabase
    .from('email_sequence_step_executions')
    .insert({
      enrollment_id: enrollment.id,
      step_id: step.id,
      executed_at: new Date().toISOString(),
      status: 'executed',
      result: { condition_met: conditionMet },
    });
}

/**
 * Advance enrollment to the next step
 */
async function advanceToNextStep(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: Enrollment
) {
  // Get next step
  const { data: nextStep } = await supabase
    .from('email_sequence_steps')
    .select('*')
    .eq('sequence_id', enrollment.sequence_id)
    .gt('step_order', enrollment.current_step_order)
    .order('step_order', { ascending: true })
    .limit(1)
    .single();

  if (!nextStep) {
    // No more steps, mark as completed
    await completeEnrollment(supabase, enrollment.id);
    return;
  }

  // Calculate next step time
  const nextStepAt = calculateNextStepTime(
    nextStep.delay_days || 0,
    nextStep.delay_hours || 0,
    nextStep.delay_minutes || 0,
    nextStep.send_time,
    nextStep.send_days
  );

  // Update enrollment
  await supabase
    .from('email_sequence_enrollments')
    .update({
      current_step_id: nextStep.id,
      current_step_order: nextStep.step_order,
      last_step_at: new Date().toISOString(),
      next_step_at: nextStepAt,
    })
    .eq('id', enrollment.id);
}

/**
 * Check exit conditions for an enrollment
 */
async function checkExitConditions(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: Enrollment & { sequence: EmailSequence }
): Promise<string | null> {
  const exitConditions = enrollment.sequence.exit_conditions;
  const settings = enrollment.sequence.settings;

  if (!exitConditions && !settings) {
    return null;
  }

  // Check settings-based exit conditions
  if (settings?.stop_on_reply) {
    const { data: reply } = await supabase
      .from('email_tracking_events')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('event_type', 'reply')
      .limit(1)
      .single();

    if (reply) {
      return 'Reply received';
    }
  }

  if (settings?.stop_on_bounce) {
    const { data: bounce } = await supabase
      .from('email_tracking_events')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('event_type', 'bounce')
      .limit(1)
      .single();

    if (bounce) {
      return 'Email bounced';
    }
  }

  // Check configured exit conditions
  if (exitConditions) {
    for (const condition of exitConditions) {
      switch (condition.type) {
        case 'unsubscribed':
          const { data: unsubRecord } = await supabase
            .from('email_unsubscribes')
            .select('id')
            .eq('email', enrollment.email)
            .limit(1)
            .single();

          if (unsubRecord) {
            return 'Contact unsubscribed';
          }
          break;

        case 'tag_added':
          if (condition.tag) {
            const { data: record } = await supabase
              .from('crm_records')
              .select('tags')
              .eq('id', enrollment.record_id)
              .single();

            if (record?.tags?.includes(condition.tag)) {
              return `Tag "${condition.tag}" added`;
            }
          }
          break;
      }
    }
  }

  return null;
}

/**
 * Helper functions
 */

function calculateNextStepTime(
  delayDays: number,
  delayHours: number,
  delayMinutes: number,
  sendTime?: string | null,
  sendDays?: number[] | null
): string {
  let nextTime = new Date();

  // Add delay
  nextTime.setDate(nextTime.getDate() + delayDays);
  nextTime.setHours(nextTime.getHours() + delayHours);
  nextTime.setMinutes(nextTime.getMinutes() + delayMinutes);

  // Set specific send time if configured
  if (sendTime) {
    const [hours, minutes] = sendTime.split(':').map(Number);
    nextTime.setHours(hours, minutes, 0, 0);

    // If time has passed today, move to tomorrow
    if (nextTime < new Date()) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  }

  // Adjust for send days if configured
  if (sendDays && sendDays.length > 0) {
    while (!sendDays.includes(nextTime.getDay())) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  }

  return nextTime.toISOString();
}

function processMergeFields(text: string, data: Record<string, unknown>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split('.');
    let value: unknown = data;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match; // Keep original if path not found
      }
    }

    return String(value || '');
  });
}

function evaluateFieldCondition(fieldValue: unknown, operator: string, targetValue: unknown): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === targetValue;
    case 'not_equals':
      return fieldValue !== targetValue;
    case 'contains':
      return String(fieldValue).includes(String(targetValue));
    case 'is_empty':
      return !fieldValue;
    case 'is_not_empty':
      return !!fieldValue;
    default:
      return false;
  }
}

async function completeEnrollment(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string
) {
  await supabase
    .from('email_sequence_enrollments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);

  // Update sequence stats
  const { data: enrollment } = await supabase
    .from('email_sequence_enrollments')
    .select('sequence_id')
    .eq('id', enrollmentId)
    .single();

  if (enrollment) {
    await supabase.rpc('increment_sequence_completed', {
      sequence_id: enrollment.sequence_id,
    });
  }
}

async function exitEnrollment(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
  reason: string
) {
  await supabase
    .from('email_sequence_enrollments')
    .update({
      status: 'exited',
      exit_reason: reason,
      exited_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);
}

async function pauseEnrollment(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
  reason: string
) {
  await supabase
    .from('email_sequence_enrollments')
    .update({
      status: 'paused',
      exit_reason: reason,
    })
    .eq('id', enrollmentId);
}

/**
 * Enroll a record into a sequence
 */
export async function enrollRecord(
  supabase: ReturnType<typeof createAdminClient>,
  sequenceId: string,
  recordId: string,
  moduleKey: string,
  email: string,
  enrolledBy: string
) {
  // Get the first step
  const { data: firstStep } = await supabase
    .from('email_sequence_steps')
    .select('id, step_order, delay_days, delay_hours, delay_minutes, send_time, send_days')
    .eq('sequence_id', sequenceId)
    .order('step_order', { ascending: true })
    .limit(1)
    .single();

  if (!firstStep) {
    throw new Error('Sequence has no steps');
  }

  const nextStepAt = calculateNextStepTime(
    firstStep.delay_days || 0,
    firstStep.delay_hours || 0,
    firstStep.delay_minutes || 0,
    firstStep.send_time,
    firstStep.send_days
  );

  const { data: enrollment, error } = await supabase
    .from('email_sequence_enrollments')
    .insert({
      sequence_id: sequenceId,
      record_id: recordId,
      module_key: moduleKey,
      email,
      current_step_id: firstStep.id,
      current_step_order: firstStep.step_order,
      status: 'active',
      enrolled_by: enrolledBy,
      next_step_at: nextStepAt,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return enrollment;
}
