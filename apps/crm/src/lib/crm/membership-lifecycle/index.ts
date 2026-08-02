/**
 * MembershipLifecycle — facade for CRM-record coverage status transitions.
 *
 * Deep logic stays in resolve-effective-end-date / scheduled-end-date-cancel /
 * age-65-auto-cancel / resolve-effective-start-date / pending-activation.
 * Callers (cron, patch, view) should import from this module so transition
 * rules have one entry seam.
 *
 * IMPORTANT: Billing table `memberships` (activate-due-memberships cron) is a
 * separate lifecycle. Prefer `@/lib/crm/member-activation` when coordinating
 * both CRM and billing adapters. Do not merge table paths without an explicit
 * design.
 */

export {
  TERMINAL_CONTACT_STATUSES,
  isEligibleForScheduledCancellation,
  isScheduledCancellationDue,
  resolveEffectiveEndDate,
  type CrmRecordEndDateInput,
} from '../resolve-effective-end-date';

export {
  buildScheduledCancellationUpdates,
  applyScheduledEndDateCancelForRecord,
  applyScheduledEndDateCancelForRecordView,
  type RecordForScheduledCancel,
  type ScheduledCancelResult,
} from '../scheduled-end-date-cancel';

export { applyAge65AutoCancelForRecord } from '../age-65-auto-cancel';

export {
  resolveEffectiveStartDate,
  PENDING_CONTACT_STATUSES,
  ACTIVE_STATUS_BY_MARKET,
  resolveActiveStatusForMarket,
  type CrmRecordStartDateInput,
} from '../resolve-effective-start-date';

export {
  isPendingContactStatus,
  isEligibleForActivation,
  isActivationDue,
  buildActivationUpdates,
  applyPendingActivationForRecord,
  type ActivationDueCheck,
  type PendingActivationResult,
  type RecordForPendingActivation,
} from '../pending-activation';
