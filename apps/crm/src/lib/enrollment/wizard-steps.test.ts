import { describe, expect, it } from 'vitest';
import { firstIncompleteWizardStep, WIZARD_STEPS } from './wizard-steps';

describe('firstIncompleteWizardStep', () => {
  it('returns intake when no steps are completed', () => {
    expect(firstIncompleteWizardStep({})).toBe('intake');
  });

  it('returns the first incomplete step in wizard order', () => {
    expect(
      firstIncompleteWizardStep({
        intake: { isCompleted: true },
        household: { isCompleted: true },
        plan_selection: { isCompleted: false },
      })
    ).toBe('plan_selection');
  });

  it('skips missing statuses as incomplete', () => {
    expect(
      firstIncompleteWizardStep({
        intake: { isCompleted: true },
      })
    ).toBe('household');
  });

  it('returns confirmation when every step is complete', () => {
    const allDone = Object.fromEntries(
      WIZARD_STEPS.map((step) => [step.key, { isCompleted: true }])
    );
    expect(firstIncompleteWizardStep(allDone)).toBe('confirmation');
  });
});
