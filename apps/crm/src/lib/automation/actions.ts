/**
 * CRM Automation Pack - Action Executor
 * Executes workflow actions against records
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CrmRecord, CrmTask, CrmNote } from '../crm/types';
import type {
  WorkflowAction,
  ActionResult,
  ActionType,
  AutomationContext,
  UpdateFieldsConfig,
  AssignOwnerConfig,
  CreateTaskConfig,
  CreateActivityConfig,
  AddNoteConfig,
  NotifyConfig,
  MoveStageConfig,
  StartCadenceConfig,
  StopCadenceConfig,
  CreateEnrollmentDraftConfig,
  SendEmailConfig,
  SendSmsConfig,
  DelayWaitConfig,
  PostWebhookConfig,
  CrmAssignmentRule,
} from './types';
import { dispatchMessage } from '../comms';
import { executeAssignment } from './assignment';

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

/**
 * Creates a service role client for privileged operations
 */
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
// User Resolution
// ============================================================================

type UserTarget = 'owner' | 'creator' | string;

async function resolveUserId(
  target: UserTarget,
  record: CrmRecord,
  context: AutomationContext
): Promise<string | null> {
  if (target === 'owner') {
    return record.owner_id || null;
  }
  if (target === 'creator') {
    return record.created_by || null;
  }
  // Assume it's a specific user ID
  return target;
}

async function resolveUserIds(
  targets: UserTarget[],
  record: CrmRecord,
  context: AutomationContext
): Promise<string[]> {
  const userIds: string[] = [];
  for (const target of targets) {
    const userId = await resolveUserId(target, record, context);
    if (userId && !userIds.includes(userId)) {
      userIds.push(userId);
    }
  }
  return userIds;
}

// ============================================================================
// Action Implementations
// ============================================================================

async function executeUpdateFields(
  config: UpdateFieldsConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  if (context.dryRun) {
    return {
      actionId: 'update_fields',
      type: 'update_fields',
      status: 'success',
      output: { wouldUpdate: config.fields },
    };
  }

  const supabase = await createClient();

  // Separate system fields from data fields
  const systemFields = ['title', 'status', 'stage', 'email', 'phone', 'owner_id'];
  const updates: Record<string, unknown> = {};
  const dataUpdates: Record<string, unknown> = { ...record.data };

  for (const [key, value] of Object.entries(config.fields)) {
    if (systemFields.includes(key)) {
      updates[key] = value;
    } else {
      dataUpdates[key] = value;
    }
  }

  updates.data = dataUpdates;

  const { error } = await supabase
    .from('crm_records')
    .update(updates)
    .eq('id', record.id);

  if (error) {
    return {
      actionId: 'update_fields',
      type: 'update_fields',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: 'update_fields',
    type: 'update_fields',
    status: 'success',
    output: { updated: config.fields },
  };
}

async function executeAssignOwner(
  config: AssignOwnerConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    let assignedUserId: string | null = null;

    if (config.userId) {
      // Fixed assignment
      assignedUserId = config.userId;
    } else if (config.ruleId) {
      // Use assignment rule
      const { data: rule } = await supabase
        .from('crm_assignment_rules')
        .select('*')
        .eq('id', config.ruleId)
        .single();

      if (rule) {
        assignedUserId = await executeAssignment(
          rule as CrmAssignmentRule,
          record,
          context,
          context.dryRun
        );
      }
    }

    if (!assignedUserId) {
      return {
        actionId: 'assign_owner',
        type: 'assign_owner',
        status: 'skipped',
        output: { reason: 'No user to assign' },
      };
    }

    if (context.dryRun) {
      return {
        actionId: 'assign_owner',
        type: 'assign_owner',
        status: 'success',
        output: { wouldAssign: assignedUserId },
      };
    }

    const { error } = await supabase
      .from('crm_records')
      .update({ owner_id: assignedUserId })
      .eq('id', record.id);

    if (error) {
      return {
        actionId: 'assign_owner',
        type: 'assign_owner',
        status: 'failed',
        error: error.message,
      };
    }

    return {
      actionId: 'assign_owner',
      type: 'assign_owner',
      status: 'success',
      output: { assigned: assignedUserId },
    };
  } catch (error) {
    return {
      actionId: 'assign_owner',
      type: 'assign_owner',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function executeCreateTask(
  config: CreateTaskConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  const assignedTo = await resolveUserId(
    config.assignedTo || 'owner',
    record,
    context
  );

  const dueAt = config.dueInDays
    ? new Date(Date.now() + config.dueInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  if (context.dryRun) {
    return {
      actionId: 'create_task',
      type: 'create_task',
      status: 'success',
      output: {
        wouldCreate: {
          title: config.title,
          description: config.description,
          due_at: dueAt,
          priority: config.priority || 'normal',
          assigned_to: assignedTo,
        },
      },
    };
  }

  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from('crm_tasks')
    .insert({
      org_id: context.orgId,
      record_id: record.id,
      title: config.title,
      description: config.description,
      due_at: dueAt,
      priority: config.priority || 'normal',
      assigned_to: assignedTo,
      created_by: context.profileId,
    })
    .select()
    .single();

  if (error) {
    return {
      actionId: 'create_task',
      type: 'create_task',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: 'create_task',
    type: 'create_task',
    status: 'success',
    output: { taskId: task.id },
  };
}

async function executeAddNote(
  config: AddNoteConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  if (context.dryRun) {
    return {
      actionId: 'add_note',
      type: 'add_note',
      status: 'success',
      output: { wouldCreate: { body: config.body, isPinned: config.isPinned } },
    };
  }

  const supabase = await createClient();

  const { data: note, error } = await supabase
    .from('crm_notes')
    .insert({
      org_id: context.orgId,
      record_id: record.id,
      body: config.body,
      is_pinned: config.isPinned || false,
      created_by: context.profileId,
    })
    .select()
    .single();

  if (error) {
    return {
      actionId: 'add_note',
      type: 'add_note',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: 'add_note',
    type: 'add_note',
    status: 'success',
    output: { noteId: note.id },
  };
}

async function executeNotify(
  config: NotifyConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  const userIds = await resolveUserIds(config.recipients, record, context);

  if (userIds.length === 0) {
    return {
      actionId: 'notify',
      type: 'notify',
      status: 'skipped',
      output: { reason: 'No recipients' },
    };
  }

  if (context.dryRun) {
    return {
      actionId: 'notify',
      type: 'notify',
      status: 'success',
      output: { wouldNotify: userIds, title: config.title },
    };
  }

  const supabase = await createClient();

  const notifications = userIds.map(userId => ({
    org_id: context.orgId,
    user_id: userId,
    title: config.title,
    body: config.body,
    href: config.href || `/crm/r/${record.id}`,
    meta: {
      record_id: record.id,
      workflow_trigger: context.trigger,
    },
  }));

  const { error } = await supabase
    .from('crm_notifications')
    .insert(notifications);

  if (error) {
    return {
      actionId: 'notify',
      type: 'notify',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: 'notify',
    type: 'notify',
    status: 'success',
    output: { notified: userIds },
  };
}

async function executeMoveStage(
  config: MoveStageConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  if (context.dryRun) {
    return {
      actionId: 'move_stage',
      type: 'move_stage',
      status: 'success',
      output: { wouldMoveTo: config.stage, from: record.stage },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_records')
    .update({ stage: config.stage })
    .eq('id', record.id);

  if (error) {
    return {
      actionId: 'move_stage',
      type: 'move_stage',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: 'move_stage',
    type: 'move_stage',
    status: 'success',
    output: { movedTo: config.stage, from: record.stage },
  };
}

async function executeStartCadence(
  config: StartCadenceConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  const supabase = await createClient();

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('crm_cadence_enrollments')
    .select('id, status')
    .eq('cadence_id', config.cadenceId)
    .eq('record_id', record.id)
    .single();

  if (existing && existing.status === 'active') {
    return {
      actionId: 'start_cadence',
      type: 'start_cadence',
      status: 'skipped',
      output: { reason: 'Already enrolled in cadence' },
    };
  }

  // Get cadence to calculate first step
  const { data: cadence } = await supabase
    .from('crm_cadences')
    .select('*')
    .eq('id', config.cadenceId)
    .single();

  if (!cadence || !cadence.is_enabled) {
    return {
      actionId: 'start_cadence',
      type: 'start_cadence',
      status: 'skipped',
      output: { reason: 'Cadence not found or disabled' },
    };
  }

  const steps = cadence.steps as { delayDays?: number }[];
  const firstStepDelay = steps[0]?.delayDays || 0;
  const nextStepAt = new Date(Date.now() + firstStepDelay * 24 * 60 * 60 * 1000).toISOString();

  if (context.dryRun) {
    return {
      actionId: 'start_cadence',
      type: 'start_cadence',
      status: 'success',
      output: { wouldEnroll: config.cadenceId, nextStepAt },
    };
  }

  if (existing) {
    // Reactivate existing enrollment
    const { error } = await supabase
      .from('crm_cadence_enrollments')
      .update({
        status: 'active',
        current_step: 0,
        next_step_at: nextStepAt,
      })
      .eq('id', existing.id);

    if (error) {
      return {
        actionId: 'start_cadence',
        type: 'start_cadence',
        status: 'failed',
        error: error.message,
      };
    }
  } else {
    // Create new enrollment
    const { error } = await supabase
      .from('crm_cadence_enrollments')
      .insert({
        org_id: context.orgId,
        cadence_id: config.cadenceId,
        record_id: record.id,
        status: 'active',
        current_step: 0,
        next_step_at: nextStepAt,
        enrolled_by: context.profileId,
      });

    if (error) {
      return {
        actionId: 'start_cadence',
        type: 'start_cadence',
        status: 'failed',
        error: error.message,
      };
    }
  }

  return {
    actionId: 'start_cadence',
    type: 'start_cadence',
    status: 'success',
    output: { enrolled: config.cadenceId, nextStepAt },
  };
}

async function executeStopCadence(
  config: StopCadenceConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  if (context.dryRun) {
    return {
      actionId: 'stop_cadence',
      type: 'stop_cadence',
      status: 'success',
      output: { wouldStop: config.cadenceId || 'all' },
    };
  }

  const supabase = await createClient();

  let query = supabase
    .from('crm_cadence_enrollments')
    .update({ status: 'cancelled' })
    .eq('record_id', record.id)
    .eq('status', 'active');

  if (config.cadenceId) {
    query = query.eq('cadence_id', config.cadenceId);
  }

  const { error, count } = await query;

  if (error) {
    return {
      actionId: 'stop_cadence',
      type: 'stop_cadence',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: 'stop_cadence',
    type: 'stop_cadence',
    status: 'success',
    output: { stopped: count || 0 },
  };
}

async function executeCreateEnrollmentDraft(
  config: CreateEnrollmentDraftConfig,
  record: CrmRecord,
  context: AutomationContext,
  workflowCreatedBy: string | null
): Promise<ActionResult> {
  // Safety check: must have explicit flag
  if (!config.explicit) {
    return {
      actionId: 'create_enrollment_draft',
      type: 'create_enrollment_draft',
      status: 'skipped',
      output: { reason: 'Action config missing explicit:true flag' },
    };
  }

  // Safety check: workflow creator must be admin
  if (workflowCreatedBy) {
    const supabase = await createClient();
    const { data: creator } = await supabase
      .from('profiles')
      .select('crm_role')
      .eq('id', workflowCreatedBy)
      .single();

    if (creator?.crm_role !== 'crm_admin') {
      return {
        actionId: 'create_enrollment_draft',
        type: 'create_enrollment_draft',
        status: 'skipped',
        output: { reason: 'Workflow creator is not crm_admin' },
      };
    }
  }

  if (context.dryRun) {
    return {
      actionId: 'create_enrollment_draft',
      type: 'create_enrollment_draft',
      status: 'success',
      output: {
        wouldCreate: {
          recordId: record.id,
          planId: config.planId,
          effectiveDate: config.effectiveDate,
          additionalData: config.additionalData,
        },
      },
    };
  }

  // Use service role for enrollment operations
  const supabase = createServiceClient();

  // Extract member data from record
  const memberData = {
    first_name: record.data?.first_name || record.title?.split(' ')[0],
    last_name: record.data?.last_name || record.title?.split(' ').slice(1).join(' '),
    email: record.email || record.data?.email,
    phone: record.phone || record.data?.phone,
    organization_id: context.orgId,
    ...config.additionalData,
  };

  // Create enrollment draft (this is a simplified version - real implementation would use enrollment API)
  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .insert({
      organization_id: context.orgId,
      status: 'draft',
      selected_plan_id: config.planId,
      effective_date: config.effectiveDate,
      created_by: context.profileId,
    })
    .select()
    .single();

  if (error) {
    return {
      actionId: 'create_enrollment_draft',
      type: 'create_enrollment_draft',
      status: 'failed',
      error: error.message,
    };
  }

  // Link record to enrollment
  await supabase
    .from('crm_records')
    .update({
      data: {
        ...record.data,
        enrollment_id: enrollment.id,
        enrollment_status: 'draft',
      },
    })
    .eq('id', record.id);

  return {
    actionId: 'create_enrollment_draft',
    type: 'create_enrollment_draft',
    status: 'success',
    output: { enrollmentId: enrollment.id },
  };
}

// ============================================================================
// Activity Actions
// ============================================================================

async function executeCreateActivity(
  config: CreateActivityConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  const supabase = await createClient();
  
  // Resolve assigned user
  let assignedTo: string | null = null;
  if (config.assignedTo === 'owner') {
    assignedTo = record.owner_id || null;
  } else if (config.assignedTo === 'creator') {
    assignedTo = record.created_by || null;
  } else if (config.assignedTo) {
    assignedTo = config.assignedTo;
  }

  // Calculate due date
  let dueAt: string | null = null;
  if (config.dueInDays) {
    dueAt = new Date(Date.now() + config.dueInDays * 24 * 60 * 60 * 1000).toISOString();
  } else if (config.dueInHours) {
    dueAt = new Date(Date.now() + config.dueInHours * 60 * 60 * 1000).toISOString();
  }

  if (context.dryRun) {
    return {
      actionId: 'create_activity',
      type: 'create_activity',
      status: 'success',
      output: {
        wouldCreate: {
          activity_type: config.activityType,
          title: config.title,
          description: config.description,
          due_at: dueAt,
          priority: config.priority || 'normal',
          assigned_to: assignedTo,
          call_type: config.callType,
          meeting_type: config.meetingType,
          meeting_location: config.meetingLocation,
        },
      },
    };
  }

  const { data: activity, error } = await supabase
    .from('crm_tasks')
    .insert({
      org_id: context.orgId,
      record_id: record.id,
      title: config.title,
      description: config.description,
      activity_type: config.activityType,
      due_at: dueAt,
      priority: config.priority || 'normal',
      assigned_to: assignedTo,
      call_type: config.callType,
      meeting_type: config.meetingType,
      meeting_location: config.meetingLocation,
      attendees: config.attendees,
      created_by: context.profileId,
    })
    .select()
    .single();

  if (error) {
    return {
      actionId: 'create_activity',
      type: 'create_activity',
      status: 'failed',
      error: error.message,
    };
  }

  return {
    actionId: 'create_activity',
    type: 'create_activity',
    status: 'success',
    output: { activityId: activity.id, activityType: config.activityType },
  };
}

// ============================================================================
// Delay/Wait Actions
// ============================================================================

async function executeDelayWait(
  config: DelayWaitConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  // Calculate total delay in seconds
  let delaySeconds = config.delaySeconds || 0;
  delaySeconds += (config.delayMinutes || 0) * 60;
  delaySeconds += (config.delayHours || 0) * 60 * 60;
  delaySeconds += (config.delayDays || 0) * 24 * 60 * 60;

  if (delaySeconds <= 0) {
    return {
      actionId: 'delay_wait',
      type: 'delay_wait',
      status: 'skipped',
      output: { reason: 'No delay configured' },
    };
  }

  const scheduledFor = new Date(Date.now() + delaySeconds * 1000).toISOString();

  if (context.dryRun) {
    return {
      actionId: 'delay_wait',
      type: 'delay_wait',
      status: 'success',
      output: {
        wouldSchedule: {
          delaySeconds,
          scheduledFor,
        },
      },
    };
  }

  // In a real implementation, this would create a scheduler job
  // For now, we return the scheduled time for the engine to handle
  return {
    actionId: 'delay_wait',
    type: 'delay_wait',
    status: 'success',
    output: {
      delaySeconds,
      scheduledFor,
      requiresScheduler: true,
    },
  };
}

// ============================================================================
// Webhook Actions
// ============================================================================

async function executePostWebhook(
  config: PostWebhookConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  if (!config.url) {
    return {
      actionId: 'post_webhook',
      type: 'post_webhook',
      status: 'failed',
      error: 'No webhook URL configured',
    };
  }

  // Build request body
  let body: Record<string, unknown> = {};
  
  if (config.includeRecord !== false) {
    body = {
      record: {
        id: record.id,
        title: record.title,
        status: record.status,
        stage: record.stage,
        email: record.email,
        phone: record.phone,
        data: record.data,
      },
      trigger: context.trigger,
      timestamp: new Date().toISOString(),
    };
  }

  // Apply body template if provided
  if (config.bodyTemplate) {
    try {
      let templateStr = config.bodyTemplate;
      // Replace {{field}} placeholders with record values
      templateStr = templateStr.replace(/\{\{(\w+)\}\}/g, (_, field) => {
        if (field in record) {
          return String((record as unknown as Record<string, unknown>)[field] ?? '');
        }
        if (record.data && field in record.data) {
          return String((record.data as Record<string, unknown>)[field] ?? '');
        }
        return '';
      });
      body = JSON.parse(templateStr);
    } catch {
      return {
        actionId: 'post_webhook',
        type: 'post_webhook',
        status: 'failed',
        error: 'Invalid body template',
      };
    }
  }

  if (context.dryRun) {
    return {
      actionId: 'post_webhook',
      type: 'post_webhook',
      status: 'success',
      output: {
        wouldPost: {
          url: config.url,
          method: config.method || 'POST',
          body,
        },
      },
    };
  }

  try {
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        actionId: 'post_webhook',
        type: 'post_webhook',
        status: 'failed',
        error: `Webhook returned ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    let responseData: unknown = null;
    try {
      responseData = await response.json();
    } catch {
      // Response may not be JSON
    }

    return {
      actionId: 'post_webhook',
      type: 'post_webhook',
      status: 'success',
      output: {
        statusCode: response.status,
        response: responseData,
      },
    };
  } catch (error) {
    return {
      actionId: 'post_webhook',
      type: 'post_webhook',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Communication Actions
// ============================================================================

async function executeSendEmail(
  config: SendEmailConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  if (context.dryRun) {
    return {
      actionId: 'send_email',
      type: 'send_email',
      status: 'success',
      output: {
        wouldSend: {
          channel: 'email',
          to: config.to || record.email || record.data?.email,
          templateId: config.templateId,
          subject: config.subject,
        },
      },
    };
  }

  try {
    const result = await dispatchMessage(
      {
        recordId: record.id,
        channel: 'email',
        templateId: config.templateId,
        subject: config.subject,
        body: config.body,
        to: config.to,
      },
      context.profileId
    );

    if (result.blocked) {
      return {
        actionId: 'send_email',
        type: 'send_email',
        status: 'skipped',
        output: { reason: result.blockReason },
      };
    }

    if (!result.success) {
      return {
        actionId: 'send_email',
        type: 'send_email',
        status: 'failed',
        error: result.error,
      };
    }

    return {
      actionId: 'send_email',
      type: 'send_email',
      status: 'success',
      output: { messageId: result.messageId },
    };
  } catch (error) {
    return {
      actionId: 'send_email',
      type: 'send_email',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function executeSendSms(
  config: SendSmsConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<ActionResult> {
  if (context.dryRun) {
    return {
      actionId: 'send_sms',
      type: 'send_sms',
      status: 'success',
      output: {
        wouldSend: {
          channel: 'sms',
          to: config.to || record.phone || record.data?.phone,
          templateId: config.templateId,
        },
      },
    };
  }

  try {
    const result = await dispatchMessage(
      {
        recordId: record.id,
        channel: 'sms',
        templateId: config.templateId,
        body: config.body,
        to: config.to,
      },
      context.profileId
    );

    if (result.blocked) {
      return {
        actionId: 'send_sms',
        type: 'send_sms',
        status: 'skipped',
        output: { reason: result.blockReason },
      };
    }

    if (!result.success) {
      return {
        actionId: 'send_sms',
        type: 'send_sms',
        status: 'failed',
        error: result.error,
      };
    }

    return {
      actionId: 'send_sms',
      type: 'send_sms',
      status: 'success',
      output: { messageId: result.messageId },
    };
  } catch (error) {
    return {
      actionId: 'send_sms',
      type: 'send_sms',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Main Action Executor
// ============================================================================

export async function executeAction(
  action: WorkflowAction,
  record: CrmRecord,
  context: AutomationContext,
  workflowCreatedBy?: string | null
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'update_fields':
        return await executeUpdateFields(
          action.config as UpdateFieldsConfig,
          record,
          context
        );

      case 'assign_owner':
        return await executeAssignOwner(
          action.config as AssignOwnerConfig,
          record,
          context
        );

      case 'create_task':
        return await executeCreateTask(
          action.config as CreateTaskConfig,
          record,
          context
        );

      case 'create_activity':
        return await executeCreateActivity(
          action.config as CreateActivityConfig,
          record,
          context
        );

      case 'add_note':
        return await executeAddNote(
          action.config as AddNoteConfig,
          record,
          context
        );

      case 'notify':
        return await executeNotify(
          action.config as NotifyConfig,
          record,
          context
        );

      case 'move_stage':
        return await executeMoveStage(
          action.config as MoveStageConfig,
          record,
          context
        );

      case 'start_cadence':
        return await executeStartCadence(
          action.config as StartCadenceConfig,
          record,
          context
        );

      case 'stop_cadence':
        return await executeStopCadence(
          action.config as StopCadenceConfig,
          record,
          context
        );

      case 'create_enrollment_draft':
        return await executeCreateEnrollmentDraft(
          action.config as CreateEnrollmentDraftConfig,
          record,
          context,
          workflowCreatedBy || null
        );

      case 'send_email':
        return await executeSendEmail(
          action.config as SendEmailConfig,
          record,
          context
        );

      case 'send_sms':
        return await executeSendSms(
          action.config as SendSmsConfig,
          record,
          context
        );

      case 'delay_wait':
        return await executeDelayWait(
          action.config as DelayWaitConfig,
          record,
          context
        );

      case 'post_webhook':
        return await executePostWebhook(
          action.config as PostWebhookConfig,
          record,
          context
        );

      default:
        return {
          actionId: action.id,
          type: action.type,
          status: 'failed',
          error: `Unknown action type: ${action.type}`,
        };
    }
  } catch (error) {
    return {
      actionId: action.id,
      type: action.type,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Executes multiple actions in order
 */
export async function executeActions(
  actions: WorkflowAction[],
  record: CrmRecord,
  context: AutomationContext,
  workflowCreatedBy?: string | null
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  
  // Sort actions by order
  const sortedActions = [...actions].sort((a, b) => a.order - b.order);

  for (const action of sortedActions) {
    const result = await executeAction(action, record, context, workflowCreatedBy);
    results.push({ ...result, actionId: action.id });

    // Stop on failure unless it's a dry run
    if (result.status === 'failed' && !context.dryRun) {
      break;
    }
  }

  return results;
}
