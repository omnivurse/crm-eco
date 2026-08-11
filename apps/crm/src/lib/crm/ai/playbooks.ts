/**
 * Module playbooks — rank signal codes for lead nurture vs contact follow-up
 * vs member service. Lower weight = higher priority.
 */

const LEAD_WEIGHTS: Record<string, number> = {
  MISSING_PHONE: 10,
  MISSING_EMAIL: 20,
  DNC: 5,
  STALE_TOUCH: 15,
  OPEN_OVERDUE_TASK: 25,
  OPEN_TASKS: 40,
  MISSING_COVERAGE: 60,
  STAGE_STALE: 30,
  MEMBER_DATE_NEAR: 90,
};

const CONTACT_WEIGHTS: Record<string, number> = {
  DNC: 5,
  MISSING_PHONE: 15,
  MISSING_EMAIL: 20,
  STALE_TOUCH: 10,
  OPEN_OVERDUE_TASK: 20,
  OPEN_TASKS: 35,
  MISSING_COVERAGE: 25,
  STAGE_STALE: 40,
  MEMBER_DATE_NEAR: 50,
};

const MEMBER_WEIGHTS: Record<string, number> = {
  DNC: 5,
  MEMBER_DATE_NEAR: 8,
  MISSING_COVERAGE: 12,
  OPEN_OVERDUE_TASK: 18,
  STALE_TOUCH: 30,
  MISSING_PHONE: 35,
  MISSING_EMAIL: 40,
  OPEN_TASKS: 45,
  STAGE_STALE: 55,
};

const DEFAULT_WEIGHTS = CONTACT_WEIGHTS;

export function playbookWeights(moduleKey: string | null | undefined): Record<string, number> {
  switch ((moduleKey ?? '').toLowerCase()) {
    case 'leads':
      return LEAD_WEIGHTS;
    case 'members':
      return MEMBER_WEIGHTS;
    case 'contacts':
      return CONTACT_WEIGHTS;
    default:
      return DEFAULT_WEIGHTS;
  }
}

export function signalPriority(
  code: string,
  moduleKey: string | null | undefined,
): number {
  const weights = playbookWeights(moduleKey);
  return weights[code] ?? 100;
}

/** Soft stale-touch thresholds by module (days). */
export function staleTouchDays(moduleKey: string | null | undefined): number {
  switch ((moduleKey ?? '').toLowerCase()) {
    case 'leads':
      return 14;
    case 'members':
      return 45;
    default:
      return 30;
  }
}
