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

interface LandingPageEnrollmentWizardProps {
  existingEnrollmentId?: string;
  existingSnapshot?: WizardSnapshot;
  completedSteps?: string[];
  plans: WizardPlan[];
  prefillData?: PrefillData;
  isAuthenticated: boolean;
  advisorId?: string;
  landingPageId: string;
}

/**
 * Landing page wrapper that binds advisorId and landingPageId to the enrollment
 * creation action via closure, so the shared wizard gets the correct advisor
 * assignment without needing to know about landing pages.
 */
export function LandingPageEnrollmentWizard({
  advisorId,
  landingPageId,
  ...props
}: LandingPageEnrollmentWizardProps) {
  const actions: EnrollmentActions = {
    createEnrollment: () =>
      createSelfServeEnrollment({
        advisorId,
        landingPageId,
        enrollmentSource: 'landing_page',
      }),
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
