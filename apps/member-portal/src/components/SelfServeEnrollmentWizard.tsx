'use client';

import { SelfServeEnrollmentWizard as SharedWizard } from '@crm-eco/enrollment';
import type {
  WizardPlan,
  WizardSnapshot,
  PrefillData,
  EnrollmentActions,
  QuestionnaireTemplate,
} from '@crm-eco/enrollment';
import {
  createSelfServeEnrollment,
  completeSelfServeIntakeStep,
  completeSelfServeHouseholdStep,
  completeSelfServePlanSelectionStep,
  completeSelfServeComplianceStep,
  completeSelfServePaymentStep,
  submitSelfServeEnrollment,
  runSelfServeRxPricing,
  getSelfServeQuote,
  getSelfServeEligibility,
  completeSelfServeQuestionnaireStep,
} from '@/app/enroll/actions';

interface PortalEnrollmentWizardProps {
  existingEnrollmentId?: string;
  existingSnapshot?: WizardSnapshot;
  completedSteps?: string[];
  plans: WizardPlan[];
  prefillData?: PrefillData;
  isAuthenticated: boolean;
  /**
   * Resolved ELIGIBILITY_ENFORCE flag (default OFF), passed from the server
   * page so the env var never reaches the client bundle. When true, blocking
   * eligibility findings hard-gate the plan-selection step.
   */
  eligibilityEnforce?: boolean;
  /**
   * The org's DEFAULT, PUBLISHED questionnaire template, resolved server-side in
   * the enroll page. When present (and the action below is wired), the wizard's
   * questionnaire step goes live; when undefined, the step stays inert/skipped.
   * Flows through {...props} into the shared wizard unchanged.
   */
  questionnaireTemplate?: QuestionnaireTemplate;
}

/**
 * Portal-specific wrapper that binds server actions to the shared enrollment wizard.
 */
export function SelfServeEnrollmentWizard({
  eligibilityEnforce = false,
  ...props
}: PortalEnrollmentWizardProps) {
  const actions: EnrollmentActions = {
    createEnrollment: createSelfServeEnrollment,
    completeIntakeStep: completeSelfServeIntakeStep,
    completeHouseholdStep: completeSelfServeHouseholdStep,
    completePlanSelectionStep: completeSelfServePlanSelectionStep,
    completeComplianceStep: completeSelfServeComplianceStep,
    completePaymentStep: completeSelfServePaymentStep,
    submitEnrollment: submitSelfServeEnrollment,
    runRxPricing: runSelfServeRxPricing,
    runQuote: getSelfServeQuote,
    // DB-driven eligibility evaluator. Advisory by default; only hard-gates when
    // eligibilityEnforce (resolved from ELIGIBILITY_ENFORCE) is true.
    runEligibility: getSelfServeEligibility,
    // The questionnaire step goes live when the page passes a questionnaireTemplate
    // (the org's default published template) via {...props}; when none is loaded the
    // shared wizard auto-skips the step, so this stays non-breaking for orgs with no
    // default template.
    completeQuestionnaireStep: completeSelfServeQuestionnaireStep,
  };

  return (
    <SharedWizard
      {...props}
      actions={actions}
      eligibilityEnforce={eligibilityEnforce}
      afterSubmitUrl="/"
      afterSubmitLabel="Return to Dashboard"
    />
  );
}
