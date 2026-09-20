// @crm-eco/rates — E123 Rate Engine
export {
  quote,
  getPlanOptions,
  buildMatrixPreview,
  resolveRateSetKey,
  findAgeBand,
  resolveRatingAge,
} from './rateEngine';
export { validateRateConfig } from './validate';
export { buildRateConfigFromDb } from './dbConfig';
export { resolveEnrollmentContribution } from './enrollmentContribution';
export {
  enrollmentContributionFromSettings,
  DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY,
} from './enrollmentContributionSettings';
export { fetchEnrollmentContributionSettings } from './loadContributionPolicy';
export {
  parseCommercialTerms,
  applyCommercialTerms,
  applyGroupSizeDiscount,
  applyPeriodAmount,
  capRegistrationFees,
  householdLives,
  periodMonths,
  commercialAgeErrors,
} from './commercialTerms';
export type {
  BillingPeriod,
  BillingTiming,
  CommercialTerms,
  CommercialQuoteAdjustment,
  GroupSizeDiscount,
} from './commercialTerms';
export {
  CORE_MEMBERSHIP_CODE,
  parseCoverageConfig,
  findCoverageRule,
  applyCoverageToCharge,
  applyCoverageToCharges,
  sponsorInvoiceAmount,
} from './coverageRules';
export type {
  CoverageTreatment,
  CoveragePayer,
  ChargeCategory,
  ChargeItem,
  CoverageRule,
  CoverageConfig,
  ChargeInput,
  CoverageLine,
  CoverageAllocation,
} from './coverageRules';
export { MSA_AGE_BANDS, MSA_COVERAGE_TIERS } from './msaAgeBands';
export type {
  RateConfig,
  RateConfigMeta,
  RateSet,
  Plan,
  AgeBand,
  Region,
  TobaccoConfig,
  FeeLine,
  FeeType,
  FeeAppliesTo,
  RatingModel,
  RateSetKey,
  CoverageTier,
  AgeRatingBasis,
  MarketSegment,
  TieredHouseholdRates,
  AdditivePersonRates,
  EnrollmentContributionPolicy,
  EnrollmentContributionResult,
  QuoteInput,
  QuoteOptions,
  QuoteResult,
  QuoteFee,
  BreakdownLine,
  QuoteMetadata,
  QuoteError,
  PlanOption,
  MatrixPreview,
  ValidationResult,
  ValidationError,
} from './types';
