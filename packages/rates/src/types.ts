// ──────────────────────────────────────────────
// E123 Rate Engine – Core Types
// ──────────────────────────────────────────────

/** Which rate set to use */
export type RateSetKey = 'current' | 'rates_2026';

/** Which rating model a plan uses */
export type RatingModel = 'tiered_household' | 'additive_person';

/** Standard coverage tiers */
export type CoverageTier = 'member' | 'member_spouse' | 'member_children' | 'family';

/** Fee charging type */
export type FeeType = 'flat_monthly' | 'flat_one_time' | 'percent';

/** Where a fee applies in the flow */
export type FeeAppliesTo = 'quote' | 'enrollment' | 'checkout';

/**
 * How age is selected for tiered household rating.
 * - primary: always the member/employee age (Group)
 * - older_of_couple: max(member, spouse) for spouse/family tiers (Individual)
 */
export type AgeRatingBasis = 'primary' | 'older_of_couple';

/** MSA market segment */
export type MarketSegment = 'individual' | 'group';

// ──────────────────────────────────────────────
// Config Schema
// ──────────────────────────────────────────────

export interface RateConfig {
  meta: RateConfigMeta;
  rate_sets: {
    current: RateSet;
    rates_2026: RateSet;
  };
}

export interface RateConfigMeta {
  currency: string;
  updated_at: string;
  notes?: string;
}

export interface RateSet {
  label: string;
  effective_date: string;
  plans: Plan[];
}

export interface Plan {
  planId: string;
  displayName: string;
  rating_model: RatingModel;
  age_bands: AgeBand[];
  coverage_tiers: CoverageTier[];
  /** Defaults to primary when omitted */
  age_rating_basis?: AgeRatingBasis;
  market_segment?: MarketSegment;
  iua_amount?: number;
  provisional?: boolean;
  regions?: Region[];
  tobacco?: TobaccoConfig;
  fees?: FeeLine[];
  rates: TieredHouseholdRates | AdditivePersonRates;
}

export interface AgeBand {
  id: string;
  min: number;
  max: number;
  label: string;
}

export interface Region {
  id: string;
  label: string;
  states?: string[];
  zips?: string[];
}

export interface TobaccoConfig {
  enabled: boolean;
  factor?: number;
}

export interface FeeLine {
  id: string;
  label: string;
  type: FeeType;
  amount: number;
  applies_to: FeeAppliesTo;
  enabled: boolean;
  /** Optional metadata (split rules, provisional flags, etc.) */
  meta?: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Rating Model Rates
// ──────────────────────────────────────────────

/** tiered_household: one rate per coverage tier + age band */
export interface TieredHouseholdRates {
  [coverageTier: string]: {
    [ageBandId: string]: number;
  };
}

/** additive_person: subscriber base + optional adders */
export interface AdditivePersonRates {
  subscriber: { [ageBandId: string]: number };
  spouse_adder?: { [ageBandId: string]: number } | { flat: number };
  dependent_adder?: { [ageBandId: string]: number } | { flat: number };
  max_dependents_priced?: number;
}

// ──────────────────────────────────────────────
// Enrollment contribution policy
// ──────────────────────────────────────────────

/**
 * Org-configurable one-time enrollment contribution.
 * Amounts are provisional and adjustable without redeploy.
 */
export interface EnrollmentContributionPolicy {
  /** List price before waiver (e.g. 800) */
  amount: number;
  /** Founding-member waiver amount (e.g. 650) */
  foundingWaiver: number;
  /** Max founding members who receive the waiver (e.g. 250) */
  foundingCap: number;
  /** Whether founding waiver program is active */
  foundingEnabled: boolean;
  /** Current count of founding members already enrolled */
  foundingCount: number;
  /**
   * Force-apply or force-skip founding waiver for this quote.
   * When omitted, waiver applies if foundingEnabled && foundingCount < foundingCap.
   */
  applyFoundingWaiver?: boolean;
  /** Split metadata — not disbursed by the engine */
  splits?: {
    referringMember?: number;
    adminOps?: number;
    partnerMarketing?: number;
    pifh?: number;
  };
}

export interface EnrollmentContributionResult {
  listAmount: number;
  waiverAmount: number;
  netAmount: number;
  foundingWaiverApplied: boolean;
  splits?: EnrollmentContributionPolicy['splits'];
}

// ──────────────────────────────────────────────
// Quote Input / Options / Result
// ──────────────────────────────────────────────

export interface QuoteInput {
  planId: string;
  coverageTier: CoverageTier;
  household: {
    memberAge: number;
    spouseAge?: number;
    dependentAges?: number[];
  };
  tobacco?: {
    member?: boolean;
    spouse?: boolean;
  };
  state?: string;
  zip?: string;
  coverageStart: string;
}

export interface QuoteOptions {
  rateSetOverride?: RateSetKey;
  dependentsPricedOverride?: number;
  /** When provided, resolves enrollment-contribution fee with founding waiver */
  enrollmentContribution?: EnrollmentContributionPolicy;
}

export interface QuoteResult {
  monthlyPremium: number;
  monthlyFees: QuoteFee[];
  totalMonthly: number;
  oneTimeFees: QuoteFee[];
  breakdown: BreakdownLine[];
  metadata: QuoteMetadata;
  errors?: QuoteError[];
}

export interface QuoteFee {
  id: string;
  label: string;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface BreakdownLine {
  label: string;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface QuoteMetadata {
  planId: string;
  planName: string;
  coverageTier: CoverageTier;
  rateSetUsed: RateSetKey;
  rateSetLabel: string;
  effectiveDate: string;
  ratingModel: RatingModel;
  ageRatingBasis?: AgeRatingBasis;
  marketSegment?: MarketSegment;
  provisional?: boolean;
  ratingAge?: number;
  bandsUsed: {
    memberBand?: string;
    spouseBand?: string;
    dependentBands?: string[];
    ratingBand?: string;
  };
  enrollmentContribution?: EnrollmentContributionResult;
}

export interface QuoteError {
  code: string;
  message: string;
  path?: string;
}

// ──────────────────────────────────────────────
// Helpers for getPlanOptions / buildMatrixPreview
// ──────────────────────────────────────────────

export interface PlanOption {
  planId: string;
  displayName: string;
  ratingModel: RatingModel;
  coverageTiers: CoverageTier[];
  ageBands: AgeBand[];
  ageRatingBasis?: AgeRatingBasis;
  marketSegment?: MarketSegment;
  iuaAmount?: number;
  provisional?: boolean;
}

export interface MatrixPreview {
  planId: string;
  displayName: string;
  ratingModel: RatingModel;
  rateSetKey: RateSetKey;
  rateSetLabel: string;
  effectiveDate: string;
  ageBands: AgeBand[];
  coverageTiers: CoverageTier[];
  matrix: { [coverageTier: string]: { [ageBandId: string]: number } };
  footnotes?: string[];
  ageRatingBasis?: AgeRatingBasis;
  marketSegment?: MarketSegment;
  provisional?: boolean;
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}
