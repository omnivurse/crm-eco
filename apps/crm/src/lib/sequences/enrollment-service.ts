import { createClient } from '@supabase/supabase-js';
import type { SequenceStep, EnrollmentStatus } from './types';
import { enqueueOutbox } from '@/lib/email/outbox';
import { generateRfc822MessageId, domainFromEmail } from '@/lib/email/rfc822';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { COMMS_FLAGS, isCommsFlagEnabled } from '@/lib/email/comms-flags';
import {
  type BranchOutcome,
  MAX_STEP_EXECUTIONS,
  STEP_LIMIT_EXIT_REASON,
  engagementDeadline,
  engagementProbe,
  evaluateFieldCondition,
  isLoopingJump,
  resolveBranch,
  withinWindow,
} from './branching';
import type { ConditionConfig } from './types';
import { calculateNextStepTime } from './scheduling';
import { hasValidEnrollmentScope } from './enrollment-scope';

const INVALID_SCOPE_EXIT_REASON = 'Invalid sequence enrollment scope';

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

interface ProcessingEnrollment extends Enrollment {
  sequence: EmailSequence;
  current_step: SequenceStep | null;
  record: { id: string; org_id: string } | null;
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
      current_step:email_sequence_steps(*),
      record:crm_records(id, org_id)
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
  let skipped = 0;

  // One flag read per org per run rather than per enrollment.
  const sendAllowedByOrg = new Map<string, boolean>();
  const sendAllowed = async (orgId: string): Promise<boolean> => {
    const cached = sendAllowedByOrg.get(orgId);
    if (cached !== undefined) return cached;
    const allowed = await isCommsFlagEnabled(supabase, COMMS_FLAGS.sequenceSend, orgId, false);
    sendAllowedByOrg.set(orgId, allowed);
    return allowed;
  };

  for (const enrollment of dueEnrollments) {
    try {
      const orgId = enrollment.sequence?.org_id;

      // Enrollment RLS proves only that sequence_id belongs to the caller's
      // organization. record_id and current_step_id are user-writable FKs and
      // can point across tenants/sequences. Re-establish those relationships
      // before this service-role worker reads merge fields or executes a step.
      if (
        !hasValidEnrollmentScope({
          sequenceId: enrollment.sequence_id,
          sequenceOrganizationId: orgId,
          recordOrganizationId: enrollment.record?.org_id,
          currentStepSequenceId: enrollment.current_step?.sequence_id,
        })
      ) {
        console.error('Refusing to process an enrollment with invalid tenant scope', {
          enrollment_id: enrollment.id,
          sequence_id: enrollment.sequence_id,
        });
        await exitEnrollment(supabase, enrollment.id, INVALID_SCOPE_EXIT_REASON);
        skipped++;
        continue;
      }

      // Fails closed. A sequence fires unattended, so the gate is checked
      // before the step runs — leaving the enrollment due rather than
      // consuming it, so enabling the flag resumes exactly where it stopped.
      if (!orgId || !(await sendAllowed(orgId))) {
        skipped++;
        continue;
      }

      await processEnrollmentStep(supabase, enrollment);
      processed++;
    } catch (err) {
      console.error(`Error processing enrollment ${enrollment.id}:`, err);
      errors++;
    }
  }

  return { processed, errors, skipped };
}

/**
 * Process a single enrollment step
 */
async function processEnrollmentStep(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: ProcessingEnrollment
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
  let branch: BranchOutcome = { kind: 'next' };

  switch (currentStep.step_type) {
    case 'email':
      await executeEmailStep(supabase, enrollment, currentStep);
      break;
    case 'wait':
      // Wait steps just advance to next step
      break;
    case 'condition': {
      const conditionMet = await evaluateCondition(supabase, enrollment, currentStep);
      branch = resolveBranch(currentStep.condition_config as ConditionConfig | null, conditionMet);
      break;
    }
  }

  if (branch.kind === 'exit') {
    await exitEnrollment(supabase, enrollment.id, branch.reason);
    return;
  }

  await advanceToNextStep(
    supabase,
    enrollment,
    branch.kind === 'step' ? branch.stepId : null,
  );
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
    .eq('org_id', enrollment.sequence.org_id)
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
  const orgId = enrollment.sequence.org_id;
  const recipientName = `${record.data?.first_name || ''} ${record.data?.last_name || ''}`.trim();

  const suppressed = await isEmailSuppressed(async (email) => {
    const { data } = await supabase
      .from('email_unsubscribes')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email)
      .maybeSingle();
    return Boolean(data);
  }, enrollment.email);

  if (suppressed) {
    await supabase.from('email_sequence_step_executions').insert({
      enrollment_id: enrollment.id,
      step_id: step.id,
      executed_at: new Date().toISOString(),
      status: 'skipped',
    });
    return;
  }

  const fromEmail = step.from_email || process.env.RESEND_FROM_EMAIL || 'noreply@payitforwardhealth.com';
  const rfc822MessageId = generateRfc822MessageId(domainFromEmail(fromEmail));

  await enqueueOutbox(supabase, {
    organizationId: orgId,
    idempotencyKey: `sequence/${enrollment.id}/${step.id}`,
    senderAddress: fromEmail,
    fromName: step.from_name,
    toAddresses: [enrollment.email],
    subject,
    bodyHtml,
    bodyText,
    linkedContactId: enrollment.module_key === 'Contacts' ? enrollment.record_id : null,
    linkedLeadId: enrollment.module_key === 'Leads' ? enrollment.record_id : null,
    payload: {
      rfc822_message_id: rfc822MessageId,
      persist_inbox: false,
      to_name: recipientName,
      email_type: 'sequence',
      source: 'sequence',
      sequence_id: enrollment.sequence_id,
      enrollment_id: enrollment.id,
      step_id: step.id,
    },
  });

  await supabase.from('email_sequence_step_executions').insert({
    enrollment_id: enrollment.id,
    step_id: step.id,
    executed_at: new Date().toISOString(),
      status: 'pending',
  });
}

/**
 * Evaluate a condition step
 */
async function evaluateCondition(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: Enrollment,
  step: SequenceStep
): Promise<boolean> {
  const config = (step.condition_config ?? null) as ConditionConfig | null;

  if (!config) {
    // An unconfigured condition must not silently route anyone. Record it and
    // let the caller fall through to the next step in order.
    await supabase.from('email_sequence_step_executions').insert({
      enrollment_id: enrollment.id,
      step_id: step.id,
      executed_at: new Date().toISOString(),
      status: 'skipped',
      metadata: { reason: 'condition_not_configured' },
    });
    return false;
  }

  let conditionMet = false;

  // The tracking model for sequence sends is:
  //   sent_emails (has enrollment_id)  →  email_events (has sent_email_id, event_type)
  // The legacy code queried `email_tracking_events.enrollment_id` directly
  // but neither column existed. Resolve this enrollment's sends first, then
  // look for the relevant event against them.
  const probe = engagementProbe(config.type);

  if (probe) {
    // The most recent send is "the email" the condition refers to, which is
    // also what anchors the window.
    const { data: sends } = await supabase
      .from('sent_emails')
      .select('id, sent_at')
      .eq('sequence_enrollment_id', enrollment.id)
      .order('sent_at', { ascending: false, nullsFirst: false });

    const sentRows = (sends as { id: string; sent_at: string | null }[] | null) ?? [];

    if (sentRows.length === 0) {
      // Nothing has gone out, so no engagement is possible. "Did not open"
      // is therefore true, and "did open" is false.
      conditionMet = !probe.expectPresent;
    } else {
      const deadline = engagementDeadline(sentRows[0].sent_at, config.window_hours);

      const { data: events } = await supabase
        .from('email_events')
        .select('sent_email_id, occurred_at')
        .in(
          'sent_email_id',
          sentRows.map((r) => r.id),
        )
        .in('event_type', probe.eventTypes);

      const rows = (events as { sent_email_id: string; occurred_at: string }[] | null) ?? [];
      const engaged = rows.some((row) => withinWindow(row.occurred_at, deadline));

      conditionMet = probe.expectPresent ? engaged : !engaged;
    }
  } else if (config.type === 'field_value') {
    const { data: record } = await supabase
      .from('crm_records')
      .select('data')
      .eq('id', enrollment.record_id)
      .single();

    if (record && config.field) {
      const fieldValue = (record.data as Record<string, unknown> | null)?.[config.field];
      conditionMet = evaluateFieldCondition(
        fieldValue,
        config.operator || 'equals',
        config.value,
      );
    }
  }

  // Store the condition result for routing. The table has no `result`
  // column — use `metadata` (jsonb) which is the documented extension point.
  await supabase
    .from('email_sequence_step_executions')
    .insert({
      enrollment_id: enrollment.id,
      step_id: step.id,
      executed_at: new Date().toISOString(),
      status: 'executed',
      metadata: { condition_met: conditionMet, condition_type: config.type },
    });

  return conditionMet;
}

/**
 * Advance enrollment to the next step
 */
async function advanceToNextStep(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: Enrollment,
  branchTargetId: string | null = null,
) {
  let nextStep: SequenceStep | null = null;

  if (branchTargetId) {
    // Scoped to the sequence so a config carrying another sequence's step id
    // cannot pull someone across sequences.
    const { data: target } = await supabase
      .from('email_sequence_steps')
      .select('*')
      .eq('id', branchTargetId)
      .eq('sequence_id', enrollment.sequence_id)
      .maybeSingle();

    if (target) {
      const targetStep = target as SequenceStep;

      if (isLoopingJump(targetStep.step_order, enrollment.current_step_order)) {
        const { count } = await supabase
          .from('email_sequence_step_executions')
          .select('id', { count: 'exact', head: true })
          .eq('enrollment_id', enrollment.id);

        if ((count ?? 0) >= MAX_STEP_EXECUTIONS) {
          await exitEnrollment(supabase, enrollment.id, STEP_LIMIT_EXIT_REASON);
          return;
        }
      }

      nextStep = targetStep;
    }
    // A dangling target (step deleted) falls through to next-by-order below
    // rather than stranding the enrollment.
  }

  if (!nextStep) {
    const { data: sequential } = await supabase
      .from('email_sequence_steps')
      .select('*')
      .eq('sequence_id', enrollment.sequence_id)
      .gt('step_order', enrollment.current_step_order)
      .order('step_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    nextStep = (sequential as SequenceStep | null) ?? null;
  }

  if (!nextStep) {
    // No more steps, mark as completed
    await completeEnrollment(supabase, enrollment.id);
    return;
  }

  // Calculate next step time
  const nextStepAt = calculateNextStepTime({
    delayDays: nextStep.delay_days,
    delayHours: nextStep.delay_hours,
    delayMinutes: nextStep.delay_minutes,
    sendTime: nextStep.send_time,
    sendDays: nextStep.send_days,
  });

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

  // Check settings-based exit conditions. As above: query email_events
  // (which has sent_email_id) after first resolving the sent_emails for
  // this enrollment.
  const sentEmailIdsForExit = await (async () => {
    const { data: rows } = await supabase
      .from('sent_emails')
      .select('id')
      .eq('sequence_enrollment_id', enrollment.id);
    return ((rows as { id: string }[] | null) ?? []).map((r) => r.id);
  })();

  if (settings?.stop_on_reply && sentEmailIdsForExit.length > 0) {
    const { data: reply } = await supabase
      .from('email_events')
      .select('id')
      .in('sent_email_id', sentEmailIdsForExit)
      .eq('event_type', 'reply')
      .limit(1)
      .maybeSingle();

    if (reply) {
      return 'Reply received';
    }
  }

  if (settings?.stop_on_bounce && sentEmailIdsForExit.length > 0) {
    const { data: bounce } = await supabase
      .from('email_events')
      .select('id')
      .in('sent_email_id', sentEmailIdsForExit)
      .in('event_type', ['bounced', 'bounce'])
      .limit(1)
      .maybeSingle();

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
            // Tags live in the JSONB `data` blob (data.tags: string[]) — see
            // apps/crm/src/components/crm/records/v2/RecordTagsRow.tsx for the
            // shape. There is no top-level `tags` column on crm_records.
            const { data: record } = await supabase
              .from('crm_records')
              .select('data')
              .eq('id', enrollment.record_id)
              .single();

            const tags = (record?.data as { tags?: string[] } | null)?.tags;
            if (Array.isArray(tags) && tags.includes(condition.tag)) {
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

  const nextStepAt = calculateNextStepTime({
    delayDays: firstStep.delay_days,
    delayHours: firstStep.delay_hours,
    delayMinutes: firstStep.delay_minutes,
    sendTime: firstStep.send_time,
    sendDays: firstStep.send_days,
  });

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
