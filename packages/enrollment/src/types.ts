import type { MedicationInput, RxPricingResult, EligibilityResult } from '@crm-eco/lib';
import type { RuleConditionGroup } from '@crm-eco/lib/rules';
import type { QuoteInput, QuoteResult } from '@crm-eco/rates';

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
    date_of_birth?: string;
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
  /**
   * Derived MIRROR of the questionnaire response. The normalized rows in
   * questionnaire_responses / questionnaire_answers are the source of truth;
   * this snapshot slot is a denormalized summary for fast wizard re-hydration
   * and review. Absent until a questionnaire template is wired and answered.
   */
  questionnaire?: {
    template_id?: string;
    response_id?: string;
    /** field key -> answer value, for the questions that were shown. */
    answers?: Record<string, unknown>;
    completed_at?: string;
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

export type StepKey = 'intake' | 'household' | 'questionnaire' | 'plan_selection' | 'compliance' | 'payment' | 'confirmation';

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

// ============================================================================
// Questionnaire Types (DB-driven; inert until a template is loaded)
// ============================================================================

/**
 * The question-type vocabulary. This union is the SINGLE source of truth on the
 * TS side and is aligned 1:1 with the DB CHECK constraint
 * (questionnaire_questions_type_check in
 * supabase/drafts/202606240002_questionnaire_engine.sql), so any type the admin
 * builder writes is both DB-legal AND renderable here — no mapping layer needed.
 *
 * Answer shape (what lands in QuestionnaireAnswers, persisted as `value jsonb`):
 *  - text     -> string
 *  - number   -> number
 *  - radio    -> string (single chosen option value)
 *  - select   -> string (single chosen option value)
 *  - checkbox -> string[] (one or more chosen option values; multi-select group)
 *  - date     -> string ('YYYY-MM-DD' from a native date input)
 *  - upload   -> string (selected file name; minimal — no binary upload path yet)
 *  - section  -> NON-INPUT layout heading/divider; never emits an answer and is
 *               excluded from required-validation and the emitted answer map.
 */
export type QuestionnaireQuestionType =
  | 'text'
  | 'number'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'date'
  | 'upload'
  | 'section';

/** A single questionnaire field rendered in the wizard. */
export interface QuestionnaireQuestion {
  /** Stable key used for the answer map and conditional-logic field refs. */
  key: string;
  label: string;
  type: QuestionnaireQuestionType;
  help_text?: string;
  required?: boolean;
  /** Options for radio / checkbox / select question types. */
  options?: Array<{ value: string; label: string }>;
  /**
   * Optional show/hide rule evaluated client-side against the current answers
   * using the SHARED operator vocabulary. When absent, the question always shows.
   */
  visible_when?: RuleConditionGroup;
}

/** A DB-driven questionnaire template: its questions and metadata. */
export interface QuestionnaireTemplate {
  id: string;
  title?: string;
  description?: string;
  questions: QuestionnaireQuestion[];
}

/** field key -> answer value, for the questions that were shown. */
export type QuestionnaireAnswers = Record<string, unknown>;

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
  /**
   * Optional: server-authoritative rate quote for a selected plan. When absent,
   * the wizard renders the flat plan monthly_share — so this is non-breaking for
   * any EnrollmentActions implementer that has not wired the rate engine.
   */
  runQuote?: (
    enrollmentId: string,
    selectedPlanId: string,
    input: QuoteInput
  ) => Promise<ActionResult<QuoteResult>>;
  /**
   * Optional: evaluate DB-driven eligibility rules for the selected plan. Returns
   * a structured EligibilityResult (findings + blocking/advisory split). When
   * absent, the plan-selection step shows no eligibility panel — so this is
   * non-breaking for any EnrollmentActions implementer that has not wired the
   * eligibility evaluator. The server reports each finding's natural severity;
   * the step decides warn-vs-block via the ELIGIBILITY_ENFORCE flag it is given.
   */
  runEligibility?: (
    enrollmentId: string,
    selectedPlanId: string,
    requestedEffectiveDate: string
  ) => Promise<ActionResult<EligibilityResult>>;
  /**
   * Optional: persist a completed DB-driven questionnaire response. Normalized
   * rows (questionnaire_responses / questionnaire_answers) are the source of
   * truth; a summary is mirrored into snapshot.questionnaire. When absent — or
   * when no template is loaded — the questionnaire step renders nothing and is
   * skipped, so this is non-breaking for any EnrollmentActions implementer that
   * has not wired the questionnaire engine.
   */
  completeQuestionnaireStep?: (
    enrollmentId: string,
    templateId: string,
    answers: QuestionnaireAnswers
  ) => Promise<ActionResult>;
}

export const ENROLLMENT_STEPS: StepConfig[] = [
  { key: 'intake', title: 'Your Information', description: 'Tell us about yourself' },
  { key: 'household', title: 'Household', description: 'Add family members' },
  // Placed AFTER household so eligibility answers (which can depend on who is on
  // the plan) are collected BEFORE plan pricing/selection. Inert until a
  // questionnaire template is loaded; the wizard skips it when none is present.
  { key: 'questionnaire', title: 'Questionnaire', description: 'Answer a few eligibility questions' },
  { key: 'plan_selection', title: 'Choose a Plan', description: 'Select your coverage' },
  { key: 'compliance', title: 'Acknowledgments', description: 'Review and sign' },
  { key: 'payment', title: 'Payment', description: 'Set up billing' },
  { key: 'confirmation', title: 'Confirm', description: 'Submit enrollment' },
];
