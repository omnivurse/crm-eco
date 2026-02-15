import type { MedicationInput, RxPricingResult } from '@crm-eco/lib';

// ============================================================================
// Enrollment Types
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

export type StepKey = 'intake' | 'household' | 'plan_selection' | 'compliance' | 'payment' | 'confirmation';

export interface StepConfig {
  key: StepKey;
  title: string;
  description: string;
}

// ============================================================================
// Action Types
// ============================================================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IntakeData {
  email: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
}

export interface PlanSelectionData {
  selected_plan_id: string;
  requested_effective_date: string;
  rx_medications?: MedicationInput[];
}

export interface ComplianceData {
  acknowledged_not_insurance: boolean;
  acknowledged_sharing_guidelines: boolean;
  acknowledged_pre_existing_conditions: boolean;
  electronic_signature: string;
}

export interface PaymentData {
  payment_method: 'bank_draft' | 'credit_card';
  billing_day: number;
  payment_token?: string;
}

/**
 * Actions interface for the enrollment wizard.
 * Each app provides its own server action implementations.
 */
export interface EnrollmentActions {
  createEnrollment: () => Promise<ActionResult<{ enrollmentId: string }>>;
  completeIntakeStep: (enrollmentId: string, data: IntakeData) => Promise<ActionResult>;
  completeHouseholdStep: (enrollmentId: string, members: HouseholdMember[]) => Promise<ActionResult>;
  completePlanSelectionStep: (enrollmentId: string, data: PlanSelectionData) => Promise<ActionResult>;
  completeComplianceStep: (enrollmentId: string, data: ComplianceData) => Promise<ActionResult>;
  completePaymentStep: (enrollmentId: string, data: PaymentData) => Promise<ActionResult>;
  submitEnrollment: (enrollmentId: string) => Promise<ActionResult<{ membershipId?: string }>>;
  runRxPricing: (enrollmentId: string, medications: MedicationInput[]) => Promise<ActionResult<RxPricingResult>>;
}

export const ENROLLMENT_STEPS: StepConfig[] = [
  { key: 'intake', title: 'Your Information', description: 'Tell us about yourself' },
  { key: 'household', title: 'Household', description: 'Add family members' },
  { key: 'plan_selection', title: 'Choose a Plan', description: 'Select your coverage' },
  { key: 'compliance', title: 'Acknowledgments', description: 'Review and sign' },
  { key: 'payment', title: 'Payment', description: 'Set up billing' },
  { key: 'confirmation', title: 'Confirm', description: 'Submit enrollment' },
];
