/**
 * Server-safe wizard step helpers. Keep this file free of `'use client'`
 * so resume bootstrap can pick the next step on the server.
 */
export type WizardStep =
  | 'intake'
  | 'household'
  | 'plan_selection'
  | 'compliance'
  | 'payment'
  | 'confirmation';

export const WIZARD_STEPS: { key: WizardStep; label: string; description: string }[] = [
  { key: 'intake', label: 'Intake', description: 'Basic enrollment information' },
  { key: 'household', label: 'Household', description: 'Family members and dependents' },
  { key: 'plan_selection', label: 'Plan Selection', description: 'Choose your coverage plan' },
  { key: 'compliance', label: 'Compliance', description: 'Acknowledgements and notices' },
  { key: 'payment', label: 'Payment', description: 'Billing preferences' },
  { key: 'confirmation', label: 'Confirmation', description: 'Review and submit' },
];

export function firstIncompleteWizardStep(
  stepStatuses: Record<string, { isCompleted: boolean } | undefined>
): WizardStep {
  for (const step of WIZARD_STEPS) {
    if (!stepStatuses[step.key]?.isCompleted) return step.key;
  }
  return 'confirmation';
}
