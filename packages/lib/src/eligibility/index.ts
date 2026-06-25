/**
 * Eligibility module barrel.
 *
 * Pure helpers for evaluating configured `product_eligibility_rules`
 * (FK `plan_id -> plans(id)`) at enroll time. Currently exposes the
 * waiting-period computation (BUILD C2); the operator-based / structured rule
 * evaluator lands alongside it.
 */
export {
  computeWaitingPeriods,
} from './waitingPeriods';
export type {
  ProductEligibilityRule,
  WaitingPeriodAnchor,
  WaitingPeriodConfig,
  WaitingPeriodResult,
  ComputeWaitingPeriodsOptions,
} from './waitingPeriods';
