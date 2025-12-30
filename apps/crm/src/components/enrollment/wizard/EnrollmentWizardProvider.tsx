'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

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

export interface HouseholdMember {
  relationship: 'primary' | 'spouse' | 'child' | 'other';
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  tobaccoUse: boolean;
}

export interface WizardSnapshot {
  intake?: {
    leadId?: string | null;
    memberId?: string | null;
    isNewMember?: boolean;
    newMember?: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      dateOfBirth: string;
      state: string;
      city?: string;
      postalCode?: string;
      addressLine1?: string;
    };
    advisorId?: string | null;
    enrollmentSource?: string;
    channel?: string;
  };
  household?: {
    householdSize: number;
    members: HouseholdMember[];
  };
  plan_selection?: {
    selectedPlanId: string;
    requestedEffectiveDate: string;
    hasMandateWarning?: boolean;
    hasAge65Warning?: boolean;
  };
  compliance?: {
    healthshareAcknowledgement: boolean;
    guidelinesAcknowledgement: boolean;
    sharingLimitationsAcknowledgement: boolean;
    telehealthConsent: boolean;
    electronicCommunicationsConsent: boolean;
  };
  payment?: {
    fundingType: 'credit_card' | 'ach' | 'check' | 'other';
    billingFrequency: 'monthly' | 'annual';
    autoPay: boolean;
    billingAmount?: number;
    billingAddress?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
    };
  };
  confirmation?: {
    finalAcceptance: boolean;
  };
}

export interface StepStatus {
  isCompleted: boolean;
  completedAt?: string;
}

interface EnrollmentWizardContextType {
  // State
  enrollmentId: string | null;
  currentStep: WizardStep;
  currentStepIndex: number;
  snapshot: WizardSnapshot;
  stepStatuses: Record<WizardStep, StepStatus>;
  isLoading: boolean;
  error: string | null;

  // Member data from intake
  primaryMemberId: string | null;
  primaryMemberState: string | null;
  primaryMemberDob: string | null;

  // Plan data
  selectedPlanId: string | null;

  // Warnings
  hasMandateWarning: boolean;
  hasAge65Warning: boolean;

  // Actions
  setEnrollmentId: (id: string) => void;
  setCurrentStep: (step: WizardStep) => void;
  updateSnapshot: (stepKey: WizardStep, data: WizardSnapshot[WizardStep]) => void;
  markStepComplete: (step: WizardStep) => void;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPrimaryMemberData: (id: string, state: string | null, dob: string | null) => void;
  setSelectedPlanId: (planId: string | null) => void;
  setWarnings: (mandate: boolean, age65: boolean) => void;
  canProceed: () => boolean;
  isStepAccessible: (step: WizardStep) => boolean;
}

const EnrollmentWizardContext = createContext<EnrollmentWizardContextType | undefined>(undefined);

interface EnrollmentWizardProviderProps {
  children: React.ReactNode;
  initialEnrollmentId?: string | null;
  initialStep?: WizardStep;
  initialSnapshot?: WizardSnapshot;
  initialStepStatuses?: Record<WizardStep, StepStatus>;
}

export function EnrollmentWizardProvider({
  children,
  initialEnrollmentId = null,
  initialStep = 'intake',
  initialSnapshot = {},
  initialStepStatuses,
}: EnrollmentWizardProviderProps) {
  const [enrollmentId, setEnrollmentId] = useState<string | null>(initialEnrollmentId);
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep);
  const [snapshot, setSnapshot] = useState<WizardSnapshot>(initialSnapshot);
  const [stepStatuses, setStepStatuses] = useState<Record<WizardStep, StepStatus>>(
    initialStepStatuses || {
      intake: { isCompleted: false },
      household: { isCompleted: false },
      plan_selection: { isCompleted: false },
      compliance: { isCompleted: false },
      payment: { isCompleted: false },
      confirmation: { isCompleted: false },
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Member and plan state
  const [primaryMemberId, setPrimaryMemberId] = useState<string | null>(null);
  const [primaryMemberState, setPrimaryMemberState] = useState<string | null>(null);
  const [primaryMemberDob, setPrimaryMemberDob] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [hasMandateWarning, setHasMandateWarning] = useState(false);
  const [hasAge65Warning, setHasAge65Warning] = useState(false);

  const currentStepIndex = useMemo(
    () => WIZARD_STEPS.findIndex((s) => s.key === currentStep),
    [currentStep]
  );

  const updateSnapshot = useCallback((stepKey: WizardStep, data: WizardSnapshot[WizardStep]) => {
    setSnapshot((prev) => ({
      ...prev,
      [stepKey]: data,
    }));
  }, []);

  const markStepComplete = useCallback((step: WizardStep) => {
    setStepStatuses((prev) => ({
      ...prev,
      [step]: { isCompleted: true, completedAt: new Date().toISOString() },
    }));
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
    setError(null);
  }, []);

  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < WIZARD_STEPS.length) {
      setCurrentStep(WIZARD_STEPS[nextIndex].key);
      setError(null);
    }
  }, [currentStepIndex]);

  const prevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(WIZARD_STEPS[prevIndex].key);
      setError(null);
    }
  }, [currentStepIndex]);

  const setPrimaryMemberData = useCallback((id: string, state: string | null, dob: string | null) => {
    setPrimaryMemberId(id);
    setPrimaryMemberState(state);
    setPrimaryMemberDob(dob);
  }, []);

  const setWarnings = useCallback((mandate: boolean, age65: boolean) => {
    setHasMandateWarning(mandate);
    setHasAge65Warning(age65);
  }, []);

  const canProceed = useCallback(() => {
    // Check if current step has all required data
    return stepStatuses[currentStep]?.isCompleted || false;
  }, [currentStep, stepStatuses]);

  const isStepAccessible = useCallback(
    (step: WizardStep) => {
      const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);
      // First step is always accessible
      if (stepIndex === 0) return true;
      // Other steps require all previous steps to be completed
      for (let i = 0; i < stepIndex; i++) {
        if (!stepStatuses[WIZARD_STEPS[i].key]?.isCompleted) {
          return false;
        }
      }
      return true;
    },
    [stepStatuses]
  );

  const value = useMemo(
    () => ({
      enrollmentId,
      currentStep,
      currentStepIndex,
      snapshot,
      stepStatuses,
      isLoading,
      error,
      primaryMemberId,
      primaryMemberState,
      primaryMemberDob,
      selectedPlanId,
      hasMandateWarning,
      hasAge65Warning,
      setEnrollmentId,
      setCurrentStep,
      updateSnapshot,
      markStepComplete,
      goToStep,
      nextStep,
      prevStep,
      setIsLoading,
      setError,
      setPrimaryMemberData,
      setSelectedPlanId,
      setWarnings,
      canProceed,
      isStepAccessible,
    }),
    [
      enrollmentId,
      currentStep,
      currentStepIndex,
      snapshot,
      stepStatuses,
      isLoading,
      error,
      primaryMemberId,
      primaryMemberState,
      primaryMemberDob,
      selectedPlanId,
      hasMandateWarning,
      hasAge65Warning,
      updateSnapshot,
      markStepComplete,
      goToStep,
      nextStep,
      prevStep,
      setPrimaryMemberData,
      setWarnings,
      canProceed,
      isStepAccessible,
    ]
  );

  return (
    <EnrollmentWizardContext.Provider value={value}>
      {children}
    </EnrollmentWizardContext.Provider>
  );
}

export function useEnrollmentWizard() {
  const context = useContext(EnrollmentWizardContext);
  if (context === undefined) {
    throw new Error('useEnrollmentWizard must be used within an EnrollmentWizardProvider');
  }
  return context;
}

