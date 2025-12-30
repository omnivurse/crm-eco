'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { Check, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import {
  SelfServeIntakeStep,
  SelfServeHouseholdStep,
  SelfServePlanSelectionStep,
  SelfServeComplianceStep,
  SelfServePaymentStep,
  SelfServeConfirmationStep,
} from './steps';
import type { MedicationInput, RxPricingResult } from '@crm-eco/lib';
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

// ============================================================================
// Types
// ============================================================================

export interface WizardPlan {
  id: string;
  name: string;
  code: string;
  monthly_share: number;
  description: string | null;
}

export interface WizardSnapshot {
  intake?: {
    email?: string;
    phone?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  household?: {
    members: HouseholdMember[];
  };
  plan_selection?: {
    selected_plan_id?: string;
    requested_effective_date?: string;
    rx_medications?: MedicationInput[];
    rx_pricing_result?: RxPricingResult;
  };
  compliance?: {
    acknowledged_not_insurance?: boolean;
    acknowledged_sharing_guidelines?: boolean;
    acknowledged_pre_existing_conditions?: boolean;
    electronic_signature?: string;
    signed_at?: string;
  };
  payment?: {
    payment_method?: 'bank_draft' | 'credit_card';
    billing_day?: number;
  };
}

export interface HouseholdMember {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  relationship: 'spouse' | 'child' | 'dependent';
  ssn_last4?: string;
}

export interface PrefillData {
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
}

interface SelfServeEnrollmentWizardProps {
  existingEnrollmentId?: string;
  existingSnapshot?: WizardSnapshot;
  completedSteps?: string[];
  plans: WizardPlan[];
  prefillData?: PrefillData;
  isAuthenticated: boolean;
}

// ============================================================================
// Steps Configuration
// ============================================================================

type StepKey = 'intake' | 'household' | 'plan_selection' | 'compliance' | 'payment' | 'confirmation';

interface StepConfig {
  key: StepKey;
  title: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { key: 'intake', title: 'Your Information', description: 'Tell us about yourself' },
  { key: 'household', title: 'Household', description: 'Add family members' },
  { key: 'plan_selection', title: 'Choose a Plan', description: 'Select your coverage' },
  { key: 'compliance', title: 'Acknowledgments', description: 'Review and sign' },
  { key: 'payment', title: 'Payment', description: 'Set up billing' },
  { key: 'confirmation', title: 'Confirm', description: 'Submit enrollment' },
];

// ============================================================================
// Component
// ============================================================================

export function SelfServeEnrollmentWizard({
  existingEnrollmentId,
  existingSnapshot,
  completedSteps = [],
  plans,
  prefillData,
  isAuthenticated,
}: SelfServeEnrollmentWizardProps) {
  // State
  const [enrollmentId, setEnrollmentId] = useState<string | undefined>(existingEnrollmentId);
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    // Start at first incomplete step
    const firstIncomplete = STEPS.findIndex((step) => !completedSteps.includes(step.key));
    return Math.max(0, firstIncomplete === -1 ? STEPS.length - 1 : firstIncomplete);
  });
  const [snapshot, setSnapshot] = useState<WizardSnapshot>(existingSnapshot || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const currentStep = STEPS[currentStepIndex];

  // Track completed steps locally
  const [localCompletedSteps, setLocalCompletedSteps] = useState<Set<string>>(
    new Set(completedSteps)
  );

  // Helpers
  const markStepComplete = useCallback((stepKey: string) => {
    setLocalCompletedSteps((prev) => new Set([...Array.from(prev), stepKey]));
  }, []);

  const updateSnapshot = useCallback(<K extends keyof WizardSnapshot>(
    key: K,
    data: WizardSnapshot[K]
  ) => {
    setSnapshot((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...data },
    }));
  }, []);

  const goToNextStep = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setError(null);
    }
  }, [currentStepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setError(null);
    }
  }, [currentStepIndex]);

  // Ensure enrollment exists
  const ensureEnrollment = useCallback(async (): Promise<string | null> => {
    if (enrollmentId) return enrollmentId;

    setLoading(true);
    setError(null);

    try {
      const result = await createSelfServeEnrollment();
      if (!result.success || !result.data) {
        setError(result.error || 'Failed to create enrollment');
        return null;
      }
      setEnrollmentId(result.data.enrollmentId);
      return result.data.enrollmentId;
    } catch (err) {
      setError('Failed to create enrollment');
      return null;
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  // Step handlers
  const handleIntakeComplete = useCallback(async (data: WizardSnapshot['intake']) => {
    setLoading(true);
    setError(null);

    try {
      const eid = await ensureEnrollment();
      if (!eid) return;

      const result = await completeSelfServeIntakeStep(eid, data as any);
      if (!result.success) {
        setError(result.error || 'Failed to save');
        return;
      }

      updateSnapshot('intake', data);
      markStepComplete('intake');
      goToNextStep();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [ensureEnrollment, updateSnapshot, markStepComplete, goToNextStep]);

  const handleHouseholdComplete = useCallback(async (members: HouseholdMember[]) => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await completeSelfServeHouseholdStep(enrollmentId, members);
      if (!result.success) {
        setError(result.error || 'Failed to save');
        return;
      }

      updateSnapshot('household', { members });
      markStepComplete('household');
      goToNextStep();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, updateSnapshot, markStepComplete, goToNextStep]);

  const handlePlanSelectionComplete = useCallback(async (data: {
    selected_plan_id: string;
    requested_effective_date: string;
    rx_medications?: MedicationInput[];
  }) => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await completeSelfServePlanSelectionStep(enrollmentId, data);
      if (!result.success) {
        setError(result.error || 'Failed to save');
        return;
      }

      updateSnapshot('plan_selection', data);
      markStepComplete('plan_selection');
      goToNextStep();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, updateSnapshot, markStepComplete, goToNextStep]);

  const handleRxPricing = useCallback(async (medications: MedicationInput[]): Promise<RxPricingResult | null> => {
    if (!enrollmentId) return null;

    try {
      const result = await runSelfServeRxPricing(enrollmentId, medications);
      if (!result.success || !result.data) {
        setError(result.error || 'Failed to get Rx pricing');
        return null;
      }

      updateSnapshot('plan_selection', { 
        rx_medications: medications,
        rx_pricing_result: result.data 
      });
      return result.data;
    } catch (err) {
      setError('Failed to get Rx pricing');
      return null;
    }
  }, [enrollmentId, updateSnapshot]);

  const handleComplianceComplete = useCallback(async (data: WizardSnapshot['compliance']) => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await completeSelfServeComplianceStep(enrollmentId, data as any);
      if (!result.success) {
        setError(result.error || 'Failed to save');
        return;
      }

      updateSnapshot('compliance', data);
      markStepComplete('compliance');
      goToNextStep();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, updateSnapshot, markStepComplete, goToNextStep]);

  const handlePaymentComplete = useCallback(async (data: WizardSnapshot['payment']) => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await completeSelfServePaymentStep(enrollmentId, data as any);
      if (!result.success) {
        setError(result.error || 'Failed to save');
        return;
      }

      updateSnapshot('payment', data);
      markStepComplete('payment');
      goToNextStep();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, updateSnapshot, markStepComplete, goToNextStep]);

  const handleSubmit = useCallback(async () => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await submitSelfServeEnrollment(enrollmentId);
      if (!result.success) {
        setError(result.error || 'Failed to submit');
        return;
      }

      markStepComplete('confirmation');
      setSubmitted(true);
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, markStepComplete]);

  // Get selected plan for display
  const selectedPlan = useMemo(() => {
    const planId = snapshot.plan_selection?.selected_plan_id;
    return plans.find((p) => p.id === planId);
  }, [plans, snapshot.plan_selection?.selected_plan_id]);

  // Render step content
  const renderStep = () => {
    switch (currentStep.key) {
      case 'intake':
        return (
          <SelfServeIntakeStep
            data={snapshot.intake}
            prefillData={prefillData}
            onComplete={handleIntakeComplete}
            loading={loading}
          />
        );

      case 'household':
        return (
          <SelfServeHouseholdStep
            members={snapshot.household?.members || []}
            onComplete={handleHouseholdComplete}
            loading={loading}
          />
        );

      case 'plan_selection':
        return (
          <SelfServePlanSelectionStep
            plans={plans}
            selectedPlanId={snapshot.plan_selection?.selected_plan_id}
            requestedEffectiveDate={snapshot.plan_selection?.requested_effective_date}
            medications={snapshot.plan_selection?.rx_medications}
            rxPricingResult={snapshot.plan_selection?.rx_pricing_result}
            memberState={snapshot.intake?.state}
            onComplete={handlePlanSelectionComplete}
            onRxPricing={handleRxPricing}
            loading={loading}
          />
        );

      case 'compliance':
        return (
          <SelfServeComplianceStep
            data={snapshot.compliance}
            onComplete={handleComplianceComplete}
            loading={loading}
          />
        );

      case 'payment':
        return (
          <SelfServePaymentStep
            data={snapshot.payment}
            selectedPlan={selectedPlan}
            onComplete={handlePaymentComplete}
            loading={loading}
          />
        );

      case 'confirmation':
        return (
          <SelfServeConfirmationStep
            snapshot={snapshot}
            selectedPlan={selectedPlan}
            submitted={submitted}
            onSubmit={handleSubmit}
            loading={loading}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between">
            {STEPS.map((step, index) => {
              const isCompleted = localCompletedSteps.has(step.key);
              const isCurrent = index === currentStepIndex;
              const isClickable = isCompleted || index <= currentStepIndex;

              return (
                <button
                  key={step.key}
                  onClick={() => isClickable && setCurrentStepIndex(index)}
                  disabled={!isClickable}
                  className={`flex flex-col items-center gap-2 flex-1 ${
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isCompleted
                        ? 'bg-green-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : index + 1}
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className={`text-sm font-medium ${isCurrent ? 'text-blue-600' : 'text-slate-700'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-slate-500">{step.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{currentStep.title}</CardTitle>
          <CardDescription>{currentStep.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep.key !== 'confirmation' && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={currentStepIndex === 0 || loading}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          {/* Next button is handled by each step */}
          <div className="text-sm text-slate-500">
            Step {currentStepIndex + 1} of {STEPS.length}
          </div>
        </div>
      )}
    </div>
  );
}

