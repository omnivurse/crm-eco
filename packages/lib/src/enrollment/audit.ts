import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

type EnrollmentAuditLogInsert = Database['public']['Tables']['enrollment_audit_log']['Insert'];

export interface LogEnrollmentAuditParams {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  enrollmentId: string;
  actorProfileId?: string | null;
  eventType: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  message?: string | null;
  dataBefore?: Record<string, unknown> | null;
  dataAfter?: Record<string, unknown> | null;
}

/**
 * Log an audit event for an enrollment
 */
export async function logEnrollmentAudit(params: LogEnrollmentAuditParams): Promise<void> {
  const {
    supabase,
    organizationId,
    enrollmentId,
    actorProfileId,
    eventType,
    oldStatus,
    newStatus,
    message,
    dataBefore,
    dataAfter,
  } = params;

  const auditEntry: EnrollmentAuditLogInsert = {
    organization_id: organizationId,
    enrollment_id: enrollmentId,
    actor_profile_id: actorProfileId || null,
    event_type: eventType,
    old_status: oldStatus || null,
    new_status: newStatus || null,
    message: message || null,
    data_before: dataBefore || null,
    data_after: dataAfter || null,
  };

  const { error } = await supabase
    .from('enrollment_audit_log')
    .insert(auditEntry);

  if (error) {
    console.error('Failed to log enrollment audit:', error);
    // Don't throw - audit failures shouldn't break the main flow
  }
}

/**
 * Common audit event types
 */
export const EnrollmentAuditEvents = {
  CREATED: 'created',
  STATUS_CHANGED: 'status_changed',
  STEP_COMPLETED: 'step_completed',
  FIELD_UPDATED: 'field_updated',
  WARNING_FLAGGED: 'warning_flagged',
  NOTE_ADDED: 'note_added',
  PLAN_SELECTED: 'plan_selected',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

/**
 * Generate a status change message
 */
export function generateStatusChangeMessage(
  oldStatus: string | null,
  newStatus: string
): string {
  if (!oldStatus) {
    return `Enrollment status set to "${newStatus}"`;
  }
  return `Enrollment status changed from "${oldStatus}" to "${newStatus}"`;
}

/**
 * Log a status change event
 */
export async function logEnrollmentStatusChange(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    enrollmentId: string;
    actorProfileId?: string | null;
    oldStatus: string | null;
    newStatus: string;
  }
): Promise<void> {
  await logEnrollmentAudit({
    supabase,
    organizationId: params.organizationId,
    enrollmentId: params.enrollmentId,
    actorProfileId: params.actorProfileId,
    eventType: EnrollmentAuditEvents.STATUS_CHANGED,
    oldStatus: params.oldStatus,
    newStatus: params.newStatus,
    message: generateStatusChangeMessage(params.oldStatus, params.newStatus),
  });
}

/**
 * Log a step completion event
 */
export async function logEnrollmentStepCompleted(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    enrollmentId: string;
    actorProfileId?: string | null;
    stepKey: string;
  }
): Promise<void> {
  await logEnrollmentAudit({
    supabase,
    organizationId: params.organizationId,
    enrollmentId: params.enrollmentId,
    actorProfileId: params.actorProfileId,
    eventType: EnrollmentAuditEvents.STEP_COMPLETED,
    message: `Step "${params.stepKey}" completed`,
  });
}

