import type {
  RateConfig,
  RateSet,
  Plan,
  ValidationResult,
  ValidationError,
  CoverageTier,
  AdditivePersonRates,
  TieredHouseholdRates,
} from './types';

const STANDARD_TIERS: CoverageTier[] = ['member', 'member_spouse', 'member_children', 'family'];

/**
 * Validate a RateConfig for structural correctness.
 * Returns { ok, errors } — never throws.
 */
export function validateRateConfig(config: RateConfig): ValidationResult {
  const errors: ValidationError[] = [];

  if (!config) {
    errors.push({ code: 'NULL_CONFIG', message: 'Config is null or undefined' });
    return { ok: false, errors };
  }

  // Meta
  if (!config.meta) {
    errors.push({ code: 'MISSING_META', message: 'Config is missing "meta" field' });
  } else {
    if (!config.meta.currency) {
      errors.push({ code: 'MISSING_CURRENCY', message: 'meta.currency is required', path: 'meta.currency' });
    }
    if (!config.meta.updated_at) {
      errors.push({ code: 'MISSING_UPDATED_AT', message: 'meta.updated_at is required', path: 'meta.updated_at' });
    }
  }

  // Rate sets
  if (!config.rate_sets) {
    errors.push({ code: 'MISSING_RATE_SETS', message: 'Config is missing "rate_sets"' });
    return { ok: false, errors };
  }

  for (const key of ['current', 'rates_2026'] as const) {
    const rateSet = config.rate_sets[key];
    if (!rateSet) {
      errors.push({ code: 'MISSING_RATE_SET', message: `rate_sets.${key} is required`, path: `rate_sets.${key}` });
      continue;
    }
    validateRateSet(rateSet, `rate_sets.${key}`, errors);
  }

  // Cross-set planId uniqueness within each set
  for (const key of ['current', 'rates_2026'] as const) {
    const rateSet = config.rate_sets[key];
    if (!rateSet?.plans) continue;
    const ids = rateSet.plans.map((p) => p.planId);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      errors.push({
        code: 'DUPLICATE_PLAN_ID',
        message: `Duplicate planId(s) in ${key}: ${Array.from(new Set(dupes)).join(', ')}`,
        path: `rate_sets.${key}.plans`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

function validateRateSet(rateSet: RateSet, path: string, errors: ValidationError[]): void {
  if (!rateSet.label) {
    errors.push({ code: 'MISSING_LABEL', message: `${path}.label is required`, path: `${path}.label` });
  }
  if (!rateSet.effective_date) {
    errors.push({
      code: 'MISSING_EFFECTIVE_DATE',
      message: `${path}.effective_date is required`,
      path: `${path}.effective_date`,
    });
  }
  if (!rateSet.plans || !Array.isArray(rateSet.plans)) {
    errors.push({ code: 'MISSING_PLANS', message: `${path}.plans must be an array`, path: `${path}.plans` });
    return;
  }

  for (let i = 0; i < rateSet.plans.length; i++) {
    validatePlan(rateSet.plans[i], `${path}.plans[${i}]`, errors);
  }
}

function validatePlan(plan: Plan, path: string, errors: ValidationError[]): void {
  if (!plan.planId) {
    errors.push({ code: 'MISSING_PLAN_ID', message: `${path}.planId is required`, path: `${path}.planId` });
  }
  if (!plan.displayName) {
    errors.push({
      code: 'MISSING_DISPLAY_NAME',
      message: `${path}.displayName is required`,
      path: `${path}.displayName`,
    });
  }
  if (!plan.rating_model || !['tiered_household', 'additive_person'].includes(plan.rating_model)) {
    errors.push({
      code: 'INVALID_RATING_MODEL',
      message: `${path}.rating_model must be "tiered_household" or "additive_person"`,
      path: `${path}.rating_model`,
    });
  }

  if (
    plan.age_rating_basis !== undefined &&
    !['primary', 'older_of_couple'].includes(plan.age_rating_basis)
  ) {
    errors.push({
      code: 'INVALID_AGE_RATING_BASIS',
      message: `${path}.age_rating_basis must be "primary" or "older_of_couple"`,
      path: `${path}.age_rating_basis`,
    });
  }

  // Age bands
  if (!plan.age_bands || plan.age_bands.length === 0) {
    errors.push({
      code: 'MISSING_AGE_BANDS',
      message: `${path}.age_bands must have at least one entry`,
      path: `${path}.age_bands`,
    });
  } else {
    const bandIds = new Set<string>();
    for (let j = 0; j < plan.age_bands.length; j++) {
      const band = plan.age_bands[j];
      const bp = `${path}.age_bands[${j}]`;
      if (!band.id) {
        errors.push({ code: 'MISSING_BAND_ID', message: `${bp}.id is required`, path: `${bp}.id` });
      }
      if (band.min === undefined || band.max === undefined) {
        errors.push({
          code: 'MISSING_BAND_RANGE',
          message: `${bp}.min and .max are required`,
          path: bp,
        });
      }
      if (band.min > band.max) {
        errors.push({
          code: 'INVALID_BAND_RANGE',
          message: `${bp}.min (${band.min}) > max (${band.max})`,
          path: bp,
        });
      }
      bandIds.add(band.id);
    }

    // Coverage tiers
    if (!plan.coverage_tiers || plan.coverage_tiers.length === 0) {
      errors.push({
        code: 'MISSING_COVERAGE_TIERS',
        message: `${path}.coverage_tiers must have at least one entry`,
        path: `${path}.coverage_tiers`,
      });
    } else {
      for (const std of STANDARD_TIERS) {
        if (!plan.coverage_tiers.includes(std)) {
          errors.push({
            code: 'MISSING_STANDARD_TIER',
            message: `${path}.coverage_tiers is missing standard tier "${std}"`,
            path: `${path}.coverage_tiers`,
          });
        }
      }
    }

    // Rates validation by model
    if (!plan.rates) {
      errors.push({ code: 'MISSING_RATES', message: `${path}.rates is required`, path: `${path}.rates` });
    } else if (plan.rating_model === 'tiered_household') {
      validateTieredRates(plan.rates as TieredHouseholdRates, bandIds, path, errors);
    } else if (plan.rating_model === 'additive_person') {
      validateAdditiveRates(plan.rates as AdditivePersonRates, bandIds, path, errors);
    }
  }

  // Fees
  if (plan.fees) {
    for (let k = 0; k < plan.fees.length; k++) {
      const fee = plan.fees[k];
      const fp = `${path}.fees[${k}]`;
      if (fee.amount < 0) {
        errors.push({
          code: 'NEGATIVE_FEE',
          message: `${fp}.amount is negative (${fee.amount})`,
          path: `${fp}.amount`,
        });
      }
    }
  }
}

function validateTieredRates(
  rates: TieredHouseholdRates,
  bandIds: Set<string>,
  path: string,
  errors: ValidationError[]
): void {
  for (const tier of STANDARD_TIERS) {
    const tierRates = rates[tier];
    if (!tierRates) {
      errors.push({
        code: 'MISSING_TIER_RATES',
        message: `${path}.rates.${tier} is missing`,
        path: `${path}.rates.${tier}`,
      });
      continue;
    }
    for (const [bandId, amount] of Object.entries(tierRates)) {
      if (!bandIds.has(bandId)) {
        errors.push({
          code: 'UNKNOWN_BAND_REF',
          message: `${path}.rates.${tier} references unknown band "${bandId}"`,
          path: `${path}.rates.${tier}.${bandId}`,
        });
      }
      if (typeof amount === 'number' && amount < 0) {
        errors.push({
          code: 'NEGATIVE_RATE',
          message: `${path}.rates.${tier}.${bandId} is negative (${amount})`,
          path: `${path}.rates.${tier}.${bandId}`,
        });
      }
    }
  }
}

function validateAdditiveRates(
  rates: AdditivePersonRates,
  bandIds: Set<string>,
  path: string,
  errors: ValidationError[]
): void {
  if (!rates.subscriber) {
    errors.push({
      code: 'MISSING_SUBSCRIBER_RATES',
      message: `${path}.rates.subscriber is required for additive_person model`,
      path: `${path}.rates.subscriber`,
    });
  } else {
    for (const [bandId, amount] of Object.entries(rates.subscriber)) {
      if (!bandIds.has(bandId)) {
        errors.push({
          code: 'UNKNOWN_BAND_REF',
          message: `${path}.rates.subscriber references unknown band "${bandId}"`,
          path: `${path}.rates.subscriber.${bandId}`,
        });
      }
      if (typeof amount === 'number' && amount < 0) {
        errors.push({
          code: 'NEGATIVE_RATE',
          message: `${path}.rates.subscriber.${bandId} is negative (${amount})`,
          path: `${path}.rates.subscriber.${bandId}`,
        });
      }
    }
  }

  // Validate spouse_adder if present and banded
  if (rates.spouse_adder && !('flat' in rates.spouse_adder)) {
    for (const [bandId, amount] of Object.entries(rates.spouse_adder)) {
      if (!bandIds.has(bandId)) {
        errors.push({
          code: 'UNKNOWN_BAND_REF',
          message: `${path}.rates.spouse_adder references unknown band "${bandId}"`,
          path: `${path}.rates.spouse_adder.${bandId}`,
        });
      }
      if (typeof amount === 'number' && amount < 0) {
        errors.push({
          code: 'NEGATIVE_RATE',
          message: `${path}.rates.spouse_adder.${bandId} is negative (${amount})`,
          path: `${path}.rates.spouse_adder.${bandId}`,
        });
      }
    }
  }

  // Validate dependent_adder if present and banded
  if (rates.dependent_adder && !('flat' in rates.dependent_adder)) {
    for (const [bandId, amount] of Object.entries(rates.dependent_adder)) {
      if (!bandIds.has(bandId)) {
        errors.push({
          code: 'UNKNOWN_BAND_REF',
          message: `${path}.rates.dependent_adder references unknown band "${bandId}"`,
          path: `${path}.rates.dependent_adder.${bandId}`,
        });
      }
      if (typeof amount === 'number' && amount < 0) {
        errors.push({
          code: 'NEGATIVE_RATE',
          message: `${path}.rates.dependent_adder.${bandId} is negative (${amount})`,
          path: `${path}.rates.dependent_adder.${bandId}`,
        });
      }
    }
  }
}
