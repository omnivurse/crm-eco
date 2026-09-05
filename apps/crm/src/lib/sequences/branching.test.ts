import { describe, it, expect } from 'vitest';
import {
  branchTargets,
  engagementDeadline,
  engagementProbe,
  evaluateFieldCondition,
  isLoopingJump,
  resolveBranch,
  stepLabel,
  withinWindow,
} from './branching';
import type { ConditionConfig } from './types';

const base: ConditionConfig = { type: 'email_opened' };

describe('resolveBranch', () => {
  it('continues to the next step when nothing is configured', () => {
    expect(resolveBranch(null, true)).toEqual({ kind: 'next' });
    expect(resolveBranch(undefined, false)).toEqual({ kind: 'next' });
  });

  it('takes the then branch when the condition is met', () => {
    const config: ConditionConfig = {
      ...base,
      then_action: 'step',
      then_step_id: 'step-yes',
      else_action: 'step',
      else_step_id: 'step-no',
    };
    expect(resolveBranch(config, true)).toEqual({ kind: 'step', stepId: 'step-yes' });
  });

  it('takes the else branch when the condition is not met', () => {
    const config: ConditionConfig = {
      ...base,
      then_action: 'step',
      then_step_id: 'step-yes',
      else_action: 'step',
      else_step_id: 'step-no',
    };
    expect(resolveBranch(config, false)).toEqual({ kind: 'step', stepId: 'step-no' });
  });

  it('exits when the branch says exit', () => {
    const config: ConditionConfig = { ...base, else_action: 'exit' };
    expect(resolveBranch(config, false)).toEqual({
      kind: 'exit',
      reason: 'Condition not met',
    });
  });

  it('records which side caused the exit', () => {
    const config: ConditionConfig = { ...base, then_action: 'exit' };
    expect(resolveBranch(config, true)).toEqual({
      kind: 'exit',
      reason: 'Condition met',
    });
  });

  it('falls through to next when a step branch has lost its target', () => {
    // Reachable when the referenced step is deleted. Stalling the enrollment
    // would be worse than continuing.
    const config: ConditionConfig = { ...base, then_action: 'step' };
    expect(resolveBranch(config, true)).toEqual({ kind: 'next' });
  });

  it('honours a bare step id with no action, for configs written earlier', () => {
    const config: ConditionConfig = { ...base, then_step_id: 'legacy-step' };
    expect(resolveBranch(config, true)).toEqual({ kind: 'step', stepId: 'legacy-step' });
  });

  it('treats an explicit next action as next', () => {
    const config: ConditionConfig = {
      ...base,
      then_action: 'next',
      then_step_id: 'ignored',
    };
    expect(resolveBranch(config, true)).toEqual({ kind: 'next' });
  });
});

describe('isLoopingJump', () => {
  it('flags backward jumps', () => {
    expect(isLoopingJump(1, 4)).toBe(true);
  });

  it('flags self jumps', () => {
    expect(isLoopingJump(3, 3)).toBe(true);
  });

  it('allows forward jumps', () => {
    expect(isLoopingJump(5, 2)).toBe(false);
  });
});

describe('engagementProbe', () => {
  it('maps positive conditions', () => {
    expect(engagementProbe('email_opened')).toEqual({
      eventTypes: ['opened', 'open'],
      expectPresent: true,
    });
  });

  it('maps negative conditions to the same events, inverted', () => {
    expect(engagementProbe('link_not_clicked')).toEqual({
      eventTypes: ['clicked', 'click'],
      expectPresent: false,
    });
  });

  it('returns null for record-state conditions', () => {
    expect(engagementProbe('field_value')).toBeNull();
  });
});

describe('engagementDeadline', () => {
  it('adds the window to the send time', () => {
    const deadline = engagementDeadline('2026-09-02T12:00:00.000Z', 24);
    expect(deadline?.toISOString()).toBe('2026-09-03T12:00:00.000Z');
  });

  it('is open ended without a window', () => {
    expect(engagementDeadline('2026-09-02T12:00:00.000Z', undefined)).toBeNull();
    expect(engagementDeadline('2026-09-02T12:00:00.000Z', 0)).toBeNull();
  });

  it('is open ended when the send time is unknown', () => {
    expect(engagementDeadline(null, 24)).toBeNull();
  });
});

describe('withinWindow', () => {
  const deadline = new Date('2026-09-03T12:00:00.000Z');

  it('accepts events before the deadline', () => {
    expect(withinWindow('2026-09-03T11:59:00.000Z', deadline)).toBe(true);
  });

  it('rejects events after the deadline', () => {
    expect(withinWindow('2026-09-03T12:00:01.000Z', deadline)).toBe(false);
  });

  it('accepts anything when there is no deadline', () => {
    expect(withinWindow('2030-01-01T00:00:00.000Z', null)).toBe(true);
  });
});

describe('evaluateFieldCondition', () => {
  it('compares equality', () => {
    expect(evaluateFieldCondition('gold', 'equals', 'gold')).toBe(true);
    expect(evaluateFieldCondition('gold', 'not_equals', 'silver')).toBe(true);
  });

  it('handles contains in both directions', () => {
    expect(evaluateFieldCondition('premium plan', 'contains', 'plan')).toBe(true);
    expect(evaluateFieldCondition('premium plan', 'not_contains', 'trial')).toBe(true);
  });

  it('treats empty string, null and undefined as unset', () => {
    expect(evaluateFieldCondition('', 'is_not_set', null)).toBe(true);
    expect(evaluateFieldCondition(null, 'is_not_set', null)).toBe(true);
    expect(evaluateFieldCondition(undefined, 'is_not_set', null)).toBe(true);
    expect(evaluateFieldCondition('x', 'is_set', null)).toBe(true);
  });

  it('does not treat a contains miss as a null crash', () => {
    expect(evaluateFieldCondition(null, 'contains', 'x')).toBe(false);
  });

  it('returns false for an unknown operator', () => {
    expect(evaluateFieldCondition('a', 'sorta_equals', 'a')).toBe(false);
  });
});

describe('branchTargets', () => {
  const steps = [
    { id: 'c', name: 'Third', step_order: 2, step_type: 'email' as const },
    { id: 'a', name: 'First', step_order: 0, step_type: 'email' as const },
    { id: 'b', name: null as unknown as string, step_order: 1, step_type: 'wait' as const },
  ];

  it('sorts by step order', () => {
    expect(branchTargets(steps, null).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('excludes the step being edited, which would loop instantly', () => {
    expect(branchTargets(steps, 'b').map((s) => s.id)).toEqual(['a', 'c']);
  });
});

describe('stepLabel', () => {
  it('numbers steps from one for display', () => {
    expect(stepLabel({ name: 'Welcome', step_order: 0, step_type: 'email' })).toBe(
      'Step 1 · Welcome',
    );
  });

  it('falls back to the step type when unnamed', () => {
    expect(stepLabel({ name: undefined, step_order: 2, step_type: 'wait' })).toBe(
      'Step 3 · wait',
    );
  });
});
