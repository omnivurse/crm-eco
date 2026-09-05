/**
 * Pure branch resolution for condition steps.
 *
 * Kept free of Supabase so the routing rules — which decide whether a real
 * person gets another email — can be tested directly.
 */

import type { ConditionConfig, ConditionOperator, SequenceStep } from './types';

export type BranchOutcome =
  | { kind: 'next' }
  | { kind: 'exit'; reason: string }
  | { kind: 'step'; stepId: string };

/**
 * A condition may jump backwards, which is legitimate (re-engagement loops)
 * but can cycle forever. Enrollments are cut off once they have executed this
 * many steps. A runaway loop here sends real mail, so the ceiling is
 * deliberately low enough to bound damage and high enough that no honest
 * sequence reaches it.
 */
export const MAX_STEP_EXECUTIONS = 200;

export const STEP_LIMIT_EXIT_REASON = 'Step limit reached (possible condition loop)';

/**
 * Which step runs next after a condition is evaluated.
 *
 * A branch set to `step` with no target — reachable when the referenced step
 * was deleted — falls through to the next step in order rather than stalling
 * the enrollment.
 */
export function resolveBranch(
  config: ConditionConfig | null | undefined,
  conditionMet: boolean,
): BranchOutcome {
  if (!config) return { kind: 'next' };

  const action = conditionMet ? config.then_action : config.else_action;
  const stepId = conditionMet ? config.then_step_id : config.else_step_id;

  if (action === 'exit') {
    return {
      kind: 'exit',
      reason: conditionMet ? 'Condition met' : 'Condition not met',
    };
  }

  if (action === 'step') {
    if (typeof stepId === 'string' && stepId.length > 0) {
      return { kind: 'step', stepId };
    }
    return { kind: 'next' };
  }

  // Absent action keeps the legacy meaning of a bare *_step_id.
  if (!action && typeof stepId === 'string' && stepId.length > 0) {
    return { kind: 'step', stepId };
  }

  return { kind: 'next' };
}

/**
 * True when jumping to `target` could revisit work already done. Only these
 * jumps need the execution-count guard; forward jumps cannot cycle.
 */
export function isLoopingJump(targetOrder: number, currentOrder: number): boolean {
  return targetOrder <= currentOrder;
}

/** Condition types that read engagement rather than record state. */
export function isEngagementCondition(type: string): boolean {
  return (
    type === 'email_opened' ||
    type === 'email_not_opened' ||
    type === 'link_clicked' ||
    type === 'link_not_clicked' ||
    type === 'replied' ||
    type === 'not_replied'
  );
}

/**
 * The event that satisfies a condition, and whether the condition is asking
 * for its presence or its absence.
 */
export function engagementProbe(
  type: string,
): { eventTypes: string[]; expectPresent: boolean } | null {
  switch (type) {
    // Both spellings are matched: webhooks normalise to the past tense, but
    // older rows used the bare verb.
    case 'email_opened':
      return { eventTypes: ['opened', 'open'], expectPresent: true };
    case 'email_not_opened':
      return { eventTypes: ['opened', 'open'], expectPresent: false };
    case 'link_clicked':
      return { eventTypes: ['clicked', 'click'], expectPresent: true };
    case 'link_not_clicked':
      return { eventTypes: ['clicked', 'click'], expectPresent: false };
    case 'replied':
      return { eventTypes: ['replied', 'reply'], expectPresent: true };
    case 'not_replied':
      return { eventTypes: ['replied', 'reply'], expectPresent: false };
    default:
      return null;
  }
}

/**
 * Latest moment an event still counts, given when the mail went out.
 * A missing or non-positive window means the engagement counts whenever it
 * happened.
 */
export function engagementDeadline(
  sentAt: string | null | undefined,
  windowHours: number | null | undefined,
): Date | null {
  if (!sentAt) return null;
  if (typeof windowHours !== 'number' || !Number.isFinite(windowHours) || windowHours <= 0) {
    return null;
  }
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return null;
  return new Date(sent.getTime() + windowHours * 60 * 60 * 1000);
}

/** Whether an event landed inside the window. */
export function withinWindow(occurredAt: string, deadline: Date | null): boolean {
  if (!deadline) return true;
  const occurred = new Date(occurredAt);
  if (Number.isNaN(occurred.getTime())) return false;
  return occurred.getTime() <= deadline.getTime();
}

export function evaluateFieldCondition(
  fieldValue: unknown,
  operator: ConditionOperator | string,
  targetValue: unknown,
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === targetValue;
    case 'not_equals':
      return fieldValue !== targetValue;
    case 'contains':
      return String(fieldValue ?? '').includes(String(targetValue ?? ''));
    case 'not_contains':
      return !String(fieldValue ?? '').includes(String(targetValue ?? ''));
    case 'is_set':
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'is_not_set':
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    default:
      return false;
  }
}

/**
 * Steps a condition may jump to. Self-reference is excluded because it is
 * always an immediate infinite loop.
 */
export function branchTargets(
  steps: Pick<SequenceStep, 'id' | 'name' | 'step_order' | 'step_type'>[],
  currentStepId: string | null | undefined,
): Pick<SequenceStep, 'id' | 'name' | 'step_order' | 'step_type'>[] {
  return steps
    .filter((s) => s.id !== currentStepId)
    .slice()
    .sort((a, b) => a.step_order - b.step_order);
}

/** Human label for a step in the branch pickers. */
export function stepLabel(
  step: Pick<SequenceStep, 'name' | 'step_order' | 'step_type'>,
): string {
  const position = `Step ${step.step_order + 1}`;
  if (step.name) return `${position} · ${step.name}`;
  return `${position} · ${step.step_type}`;
}
