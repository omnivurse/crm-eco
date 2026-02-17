'use client';

import { SelfServeEnrollmentWizard } from '@crm-eco/enrollment';
import type { WizardPlan, WizardSnapshot, PrefillData, EnrollmentActions } from '@crm-eco/enrollment';
import {
  createSelfServeEnrollment,
  completeSelfServeIntakeStep,
  completeSelfServeHouseholdStep,
  completeSelfServePlanSelectionStep,
  completeSelfServeComplianceStep,
  completeSelfServePaymentStep,
  submitSelfServeEnrollment,
  runSelfServeRxPricing,
} from '@/app/enroll/actions';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://members.payitforwardhealth.com';

interface WebsiteEnrollmentWizardProps {
  existingEnrollmentId?: string;
  existingSnapshot?: WizardSnapshot;
  completedSteps?: string[];
  plans: WizardPlan[];
  prefillData?: PrefillData;
  isAuthenticated: boolean;
}

/**
 * Website-specific wrapper that binds server actions to the shared enrollment wizard.
 * After submission, directs user to the member portal instead of a dashboard.
 */
export function WebsiteEnrollmentWizard(props: WebsiteEnrollmentWizardProps) {
  const actions: EnrollmentActions = {
    createEnrollment: createSelfServeEnrollment,
    completeIntakeStep: completeSelfServeIntakeStep,
    completeHouseholdStep: completeSelfServeHouseholdStep,
    completePlanSelectionStep: completeSelfServePlanSelectionStep,
    completeComplianceStep: completeSelfServeComplianceStep,
    completePaymentStep: completeSelfServePaymentStep,
    submitEnrollment: submitSelfServeEnrollment,
    runRxPricing: runSelfServeRxPricing,
  };

  return (
    <SelfServeEnrollmentWizard
      {...props}
      actions={actions}
      afterSubmitUrl={`${PORTAL_URL}/signin`}
      afterSubmitLabel="Sign In to Member Portal"
    />
  );
}
