/**
 * Plan-change follow-ups — when an agent logs a membership/plan change with an
 * effective date on or after today, we create a linked follow_up task so the
 * product/IUA/monthly flip is not forgotten.
 *
 * Pure helpers only — callers own the POST /api/tasks side effect.
 */

export type PlanChangeFollowUpType =
  | 'upgrade'
  | 'downgrade'
  | 'lateral'
  | 'enrollment'
  | 'cancellation';

const CHANGE_TYPE_LABEL: Record<PlanChangeFollowUpType, string> = {
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  lateral: 'Lateral move',
  enrollment: 'Enrollment',
  cancellation: 'Cancellation',
};

export type PlanChangeFollowUpInput = {
  recordId: string;
  recordTitle: string;
  changeId: string;
  type: PlanChangeFollowUpType;
  /** YYYY-MM-DD */
  effectiveDate: string;
  fromPlan?: string;
  toPlan?: string;
  notes?: string;
};

export type PlanChangeFollowUpTaskPayload = {
  title: string;
  description: string;
  activity_type: 'follow_up';
  priority: 'high';
  /** ISO datetime for due_at */
  due_date: string;
  record_id: string;
  follow_up_note: string;
};

/** Calendar today as YYYY-MM-DD in local time. */
export function localTodayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Create a reminder when the effective date is today or in the future.
 * Historical backfills (past dates) do not spawn tasks.
 */
export function shouldCreatePlanChangeFollowUp(
  effectiveDate: string,
  todayIso: string = localTodayIso(),
  /** When editing, skip if a task was already linked. */
  existingFollowUpTaskId?: string | null,
): boolean {
  if (existingFollowUpTaskId) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return false;
  return effectiveDate >= todayIso;
}

export function buildPlanChangeFollowUpTask(
  input: PlanChangeFollowUpInput,
): PlanChangeFollowUpTaskPayload {
  const typeLabel = CHANGE_TYPE_LABEL[input.type] ?? 'Plan change';
  const from = input.fromPlan?.trim() || 'current plan';
  const to = input.toPlan?.trim() || 'new plan';
  const transition = `${from} → ${to}`;
  const title = `Apply ${typeLabel.toLowerCase()}: ${transition}`;
  const lines = [
    `Effective ${input.effectiveDate}: apply this logged plan change on the contact record.`,
    `Change: ${typeLabel} — ${transition}.`,
    'Update Product / previous product, IUA, and monthly contribution to match the new plan.',
    'Do not leave the prior plan as the current product after the effective date.',
  ];
  if (input.notes?.trim()) {
    lines.push(`Agent notes: ${input.notes.trim()}`);
  }
  lines.push(`Membership change id: ${input.changeId}`);

  const description = lines.join('\n');

  return {
    title: `${title} — ${input.recordTitle}`.slice(0, 200),
    description,
    activity_type: 'follow_up',
    priority: 'high',
    // Noon local avoids UTC midnight shifting the calendar day for US agents.
    due_date: `${input.effectiveDate}T12:00:00`,
    record_id: input.recordId,
    follow_up_note: description,
  };
}
