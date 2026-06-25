'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
import {
  SelfServeIntakeStep,
  SelfServeHouseholdStep,
  SelfServeQuestionnaireStep,
  SelfServePlanSelectionStep,
  SelfServeComplianceStep,
  SelfServePaymentStep,
  SelfServeConfirmationStep,
} from './steps';
import type { MedicationInput, RxPricingResult, EligibilityResult } from '@crm-eco/lib';
import type {
  WizardPlan,
  WizardSnapshot,
  HouseholdMember,
  PrefillData,
  EnrollmentActions,
  QuestionnaireTemplate,
  QuestionnaireAnswers,
} from '../types';
import { ENROLLMENT_STEPS } from '../types';
import type { QuoteInput, QuoteResult, CoverageTier } from '@crm-eco/rates';

// ============================================================================
// Quote input adapter
// ============================================================================

/** Whole-year age on a reference date; null if DOB missing/invalid. */
function ageOnDate(dob: string | undefined, asOf: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const ref = new Date(asOf);
  if (Number.isNaN(d.getTime()) || Number.isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/**
 * Derive the engine QuoteInput from the wizard snapshot. Returns null when the
 * member DOB is missing (caller then falls back to the flat plan monthly_share).
 * Tier/household shape mirrors packages/rates exactly (see rateEngine tests).
 */
function buildQuoteInput(
  snapshot: WizardSnapshot,
  planId: string,
  coverageStart: string
): QuoteInput | null {
  const memberAge = ageOnDate(snapshot.intake?.date_of_birth, coverageStart);
  if (memberAge == null) return null;

  const members = snapshot.household?.members ?? [];
  const spouse = members.find((m) => m.relationship === 'spouse');
  const dependents = members.filter((m) => m.relationship !== 'spouse');

  const spouseAge = spouse ? ageOnDate(spouse.date_of_birth, coverageStart) : null;
  const dependentAges = dependents
    .map((d) => ageOnDate(d.date_of_birth, coverageStart))
    .filter((a): a is number => a != null);

  const hasSpouse = spouseAge != null;
  const hasDependents = dependentAges.length > 0;
  const coverageTier: CoverageTier =
    hasSpouse && hasDependents
      ? 'family'
      : hasSpouse
        ? 'member_spouse'
        : hasDependents
          ? 'member_children'
          : 'member';

  return {
    planId,
    coverageTier,
    household: {
      memberAge,
      ...(spouseAge != null ? { spouseAge } : {}),
      ...(dependentAges.length ? { dependentAges } : {}),
    },
    coverageStart,
    ...(snapshot.intake?.state ? { state: snapshot.intake.state } : {}),
    ...(snapshot.intake?.zip_code ? { zip: snapshot.intake.zip_code } : {}),
  };
}

// ============================================================================
// Props
// ============================================================================

interface SelfServeEnrollmentWizardProps {
  existingEnrollmentId?: string;
  existingSnapshot?: WizardSnapshot;
  completedSteps?: string[];
  plans: WizardPlan[];
  prefillData?: PrefillData;
  isAuthenticated: boolean;
  actions: EnrollmentActions;
  /**
   * Optional DB-driven questionnaire template. When omitted (or when
   * actions.completeQuestionnaireStep is absent), the questionnaire step is
   * inert: it renders nothing and is auto-skipped. Non-breaking for hosts that
   * have not wired the questionnaire engine.
   */
  questionnaireTemplate?: QuestionnaireTemplate;
  /** URL to navigate to after submission (e.g. portal dashboard or website home) */
  afterSubmitUrl?: string;
  /** Label for the after-submit button */
  afterSubmitLabel?: string;
  /**
   * Resolved ELIGIBILITY_ENFORCE flag (default OFF). When true, blocking
   * eligibility findings hard-gate the plan-selection step. The host resolves
   * the env flag server-side and passes the boolean so it never leaks to the
   * client bundle. When false (default), eligibility findings are advisory only.
   */
  eligibilityEnforce?: boolean;
}

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
  actions,
  questionnaireTemplate,
  afterSubmitUrl = '/',
  afterSubmitLabel = 'Return to Dashboard',
  eligibilityEnforce = false,
}: SelfServeEnrollmentWizardProps) {
  // State
  const [enrollmentId, setEnrollmentId] = useState<string | undefined>(existingEnrollmentId);
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    const firstIncomplete = ENROLLMENT_STEPS.findIndex((step) => !completedSteps.includes(step.key));
    return Math.max(0, firstIncomplete === -1 ? ENROLLMENT_STEPS.length - 1 : firstIncomplete);
  });
  const [snapshot, setSnapshot] = useState<WizardSnapshot>(existingSnapshot || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const currentStep = ENROLLMENT_STEPS[currentStepIndex];
  // Remembers which direction the user last moved, so an inert step can be
  // skipped past in the SAME direction (forward Next vs backward Previous).
  const [navDirection, setNavDirection] = useState<1 | -1>(1);

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
    if (currentStepIndex < ENROLLMENT_STEPS.length - 1) {
      setNavDirection(1);
      setCurrentStepIndex((prev) => prev + 1);
      setError(null);
    }
  }, [currentStepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setNavDirection(-1);
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
      const result = await actions.createEnrollment();
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
  }, [enrollmentId, actions]);

  // Step handlers
  const handleIntakeComplete = useCallback(async (data: WizardSnapshot['intake']) => {
    setLoading(true);
    setError(null);

    try {
      const eid = await ensureEnrollment();
      if (!eid) return;

      const result = await actions.completeIntakeStep(eid, data as any);
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
  }, [ensureEnrollment, actions, updateSnapshot, markStepComplete, goToNextStep]);

  const handleHouseholdComplete = useCallback(async (members: HouseholdMember[]) => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await actions.completeHouseholdStep(enrollmentId, members);
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
  }, [enrollmentId, actions, updateSnapshot, markStepComplete, goToNextStep]);

  // The questionnaire step is only "active" when BOTH a template is loaded and
  // the host wired the action. Otherwise it is inert and auto-skipped.
  const questionnaireActive = Boolean(
    questionnaireTemplate &&
    questionnaireTemplate.questions.length > 0 &&
    actions.completeQuestionnaireStep
  );

  const handleQuestionnaireComplete = useCallback(async (
    templateId: string,
    answers: QuestionnaireAnswers
  ) => {
    if (!enrollmentId || !actions.completeQuestionnaireStep) return;

    setLoading(true);
    setError(null);

    try {
      const result = await actions.completeQuestionnaireStep(enrollmentId, templateId, answers);
      if (!result.success) {
        setError(result.error || 'Failed to save');
        return;
      }

      // Mirror the derived summary into the snapshot (normalized rows persisted
      // server-side remain the source of truth).
      updateSnapshot('questionnaire', { template_id: templateId, answers });
      markStepComplete('questionnaire');
      goToNextStep();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, actions, updateSnapshot, markStepComplete, goToNextStep]);

  const handlePlanSelectionComplete = useCallback(async (data: {
    selected_plan_id: string;
    requested_effective_date: string;
    rx_medications?: MedicationInput[];
  }) => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await actions.completePlanSelectionStep(enrollmentId, data);
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
  }, [enrollmentId, actions, updateSnapshot, markStepComplete, goToNextStep]);

  const handleRxPricing = useCallback(async (medications: MedicationInput[]): Promise<RxPricingResult | null> => {
    if (!enrollmentId) return null;

    try {
      const result = await actions.runRxPricing(enrollmentId, medications);
      if (!result.success || !result.data) {
        setError(result.error || 'Failed to get Rx pricing');
        return null;
      }

      updateSnapshot('plan_selection', {
        rx_medications: medications,
        rx_pricing_result: result.data,
      });
      return result.data;
    } catch (err) {
      setError('Failed to get Rx pricing');
      return null;
    }
  }, [enrollmentId, actions, updateSnapshot]);

  // Server-authoritative rate quote: assemble QuoteInput from the snapshot and
  // call the (optional) runQuote action. Returns the step-expected shape; any
  // missing-DOB / unavailable / error case yields success:false so the step
  // falls back to the flat plan monthly_share.
  const handleQuote = useCallback(async (input: {
    selected_plan_id: string;
    requested_effective_date: string;
  }): Promise<{ success: boolean; result?: QuoteResult; error?: string }> => {
    if (!enrollmentId || !actions.runQuote) {
      return { success: false, error: 'unavailable' };
    }
    const quoteInput = buildQuoteInput(
      snapshot,
      input.selected_plan_id,
      input.requested_effective_date
    );
    if (!quoteInput) {
      return { success: false, error: 'NO_AGE' };
    }
    try {
      const result = await actions.runQuote(
        enrollmentId,
        input.selected_plan_id,
        quoteInput
      );
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }
      return { success: true, result: result.data };
    } catch (err) {
      return { success: false, error: 'Failed to get quote' };
    }
  }, [enrollmentId, actions, snapshot]);

  // DB-driven eligibility evaluation for the plan-selection step. Delegates to
  // the (optional) runEligibility action; the server reads the rules and
  // assembles the input from the persisted snapshot. Any unavailable/error case
  // yields success:false so the step simply shows no eligibility panel.
  const handleEligibility = useCallback(async (input: {
    selected_plan_id: string;
    requested_effective_date: string;
  }): Promise<{ success: boolean; result?: EligibilityResult; error?: string }> => {
    if (!enrollmentId || !actions.runEligibility) {
      return { success: false, error: 'unavailable' };
    }
    try {
      const result = await actions.runEligibility(
        enrollmentId,
        input.selected_plan_id,
        input.requested_effective_date,
      );
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }
      return { success: true, result: result.data };
    } catch (err) {
      return { success: false, error: 'Failed to check eligibility' };
    }
  }, [enrollmentId, actions]);

  const handleComplianceComplete = useCallback(async (data: WizardSnapshot['compliance']) => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await actions.completeComplianceStep(enrollmentId, data as any);
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
  }, [enrollmentId, actions, updateSnapshot, markStepComplete, goToNextStep]);

  const handlePaymentComplete = useCallback(async (data: WizardSnapshot['payment']) => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await actions.completePaymentStep(enrollmentId, data as any);
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
  }, [enrollmentId, actions, updateSnapshot, markStepComplete, goToNextStep]);

  const handleSubmit = useCallback(async () => {
    if (!enrollmentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await actions.submitEnrollment(enrollmentId);
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
  }, [enrollmentId, actions, markStepComplete]);

  // Auto-skip the questionnaire step when it is inert (no template/action wired).
  // Moves in the direction the user last navigated so Previous still walks
  // backward past it instead of bouncing forward. Clamped to valid bounds.
  useEffect(() => {
    if (currentStep.key !== 'questionnaire' || questionnaireActive) return;
    setCurrentStepIndex((prev) => {
      const next = prev + navDirection;
      if (next < 0 || next > ENROLLMENT_STEPS.length - 1) return prev;
      return next;
    });
  }, [currentStep.key, questionnaireActive, navDirection]);

  // Get selected plan for display
  const selectedPlan = useMemo(() => {
    const planId = snapshot.plan_selection?.selected_plan_id;
    return plans.find((p) => p.id === planId);
  }, [plans, snapshot.plan_selection?.selected_plan_id]);

  // Steps shown in the progress bar / counter. The inert questionnaire step is
  // hidden so the user never sees an empty stage. Each entry keeps its REAL
  // index into ENROLLMENT_STEPS so step-bar clicks still target the right step.
  const visibleSteps = useMemo(
    () =>
      ENROLLMENT_STEPS.map((step, index) => ({ step, index })).filter(
        ({ step }) => step.key !== 'questionnaire' || questionnaireActive
      ),
    [questionnaireActive]
  );

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

      case 'questionnaire':
        // Inert when no template/action: renders null (and the effect above
        // has already moved past this step).
        return (
          <SelfServeQuestionnaireStep
            template={questionnaireActive ? questionnaireTemplate : undefined}
            answers={snapshot.questionnaire?.answers}
            onComplete={handleQuestionnaireComplete}
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
            onQuote={actions.runQuote ? handleQuote : undefined}
            onEligibility={actions.runEligibility ? handleEligibility : undefined}
            eligibilityEnforce={eligibilityEnforce}
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
            afterSubmitUrl={afterSubmitUrl}
            afterSubmitLabel={afterSubmitLabel}
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
            {visibleSteps.map(({ step, index }, position) => {
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
                    {isCompleted ? <Check className="w-5 h-5" /> : position + 1}
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

          <div className="text-sm text-slate-500">
            Step {Math.max(0, visibleSteps.findIndex((v) => v.index === currentStepIndex)) + 1} of {visibleSteps.length}
          </div>
        </div>
      )}
    </div>
  );
}
