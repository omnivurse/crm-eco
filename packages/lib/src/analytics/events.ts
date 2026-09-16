export const ANALYTICS_EVENT_TYPES = {
  enrollmentSubmitted: 'enrollment.submitted',
  enrollmentApproved: 'enrollment.approved',
  enrollmentRejected: 'enrollment.rejected',
  enrollmentCancelled: 'enrollment.cancelled',
  memberActivated: 'member.activated',
  memberCancelled: 'member.cancelled',
  advisorCreated: 'advisor.created',
  advisorUpdated: 'advisor.updated',
  commissionCreated: 'commission.created',
  commissionUpdated: 'commission.updated',
} as const;

export type AnalyticsEventType =
  (typeof ANALYTICS_EVENT_TYPES)[keyof typeof ANALYTICS_EVENT_TYPES];

export const ANALYTICS_EVENT_SOURCES = {
  admin: 'admin',
  portal: 'portal',
  crm: 'crm',
  system: 'system',
} as const;

export interface AnalyticsEventPayload {
  status?: string | null;
  advisor_id?: string | null;
  plan_id?: string | null;
  amount?: number | null;
  [key: string]: unknown;
}

/** Safe payload: ids, status, amounts. Never PHI. */
export function buildAnalyticsPayload(input: AnalyticsEventPayload): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.status != null) payload.status = input.status;
  if (input.advisor_id != null) payload.advisor_id = input.advisor_id;
  if (input.plan_id != null) payload.plan_id = input.plan_id;
  if (input.amount != null) payload.amount = input.amount;
  for (const [key, value] of Object.entries(input)) {
    if (['status', 'advisor_id', 'plan_id', 'amount'].includes(key)) continue;
    if (FORBIDDEN_PAYLOAD_KEYS.has(key)) continue;
    payload[key] = value;
  }
  return payload;
}

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'ssn',
  'social_security',
  'date_of_birth',
  'dob',
  'address',
  'street',
  'phone',
  'email',
  'medical',
  'diagnosis',
  'medication',
  'conditions',
]);
