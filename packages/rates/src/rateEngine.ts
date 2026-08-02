import type {
  RateConfig,
  RateSetKey,
  RateSet,
  Plan,
  AgeBand,
  CoverageTier,
  QuoteInput,
  QuoteOptions,
  QuoteResult,
  QuoteError,
  QuoteFee,
  BreakdownLine,
  QuoteMetadata,
  PlanOption,
  MatrixPreview,
  AdditivePersonRates,
  TieredHouseholdRates,
  AgeRatingBasis,
} from './types';
import { resolveEnrollmentContribution } from './enrollmentContribution';

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate a quote for a given household configuration.
 * Pure function — never throws; returns structured errors.
 */
export function quote(
  config: RateConfig,
  input: QuoteInput,
  opts?: QuoteOptions
): QuoteResult {
  const errors: QuoteError[] = [];
  const breakdown: BreakdownLine[] = [];
  const monthlyFees: QuoteFee[] = [];
  const oneTimeFees: QuoteFee[] = [];

  // 1. Resolve rate set
  const rateSetKey = resolveRateSetKey(config, input.coverageStart, opts?.rateSetOverride);
  const rateSet = config.rate_sets[rateSetKey];

  // 2. Find plan
  const plan = rateSet.plans.find((p) => p.planId === input.planId);
  if (!plan) {
    return errorResult(rateSetKey, rateSet, input, [
      { code: 'PLAN_NOT_FOUND', message: `Plan "${input.planId}" not found in rate set "${rateSetKey}"` },
    ]);
  }

  // 3. Validate coverage tier requirements
  const tierErrors = validateCoverageTierHousehold(input);
  if (tierErrors.length > 0) {
    return errorResult(rateSetKey, rateSet, input, tierErrors, plan);
  }

  // 4. Calculate premium based on rating model
  let monthlyPremium = 0;
  const bandsUsed: QuoteMetadata['bandsUsed'] = {};
  let ratingAge: number | undefined;

  if (plan.rating_model === 'tiered_household') {
    const result = calcTieredHousehold(plan, input, bandsUsed);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }
    monthlyPremium = result.premium;
    ratingAge = result.ratingAge;
    breakdown.push(...result.breakdown);
  } else if (plan.rating_model === 'additive_person') {
    const result = calcAdditivePerson(plan, input, bandsUsed, opts);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }
    monthlyPremium = result.premium;
    ratingAge = input.household.memberAge;
    breakdown.push(...result.breakdown);
  } else {
    errors.push({
      code: 'UNKNOWN_RATING_MODEL',
      message: `Unknown rating model "${plan.rating_model}"`,
    });
  }

  // 5. Apply tobacco factor
  if (plan.tobacco?.enabled && plan.tobacco.factor && plan.tobacco.factor !== 1) {
    const factor = plan.tobacco.factor;
    if (input.tobacco?.member) {
      const surcharge = getSubscriberPremiumFromBreakdown(breakdown) * (factor - 1);
      monthlyPremium += surcharge;
      breakdown.push({
        label: 'Tobacco surcharge (member)',
        amount: round(surcharge),
        meta: { factor },
      });
    }
    if (input.tobacco?.spouse && (input.coverageTier === 'member_spouse' || input.coverageTier === 'family')) {
      const spouseLine = breakdown.find((b) => b.label.toLowerCase().includes('spouse'));
      if (spouseLine) {
        const surcharge = spouseLine.amount * (factor - 1);
        monthlyPremium += surcharge;
        breakdown.push({
          label: 'Tobacco surcharge (spouse)',
          amount: round(surcharge),
          meta: { factor },
        });
      }
    }
  }

  monthlyPremium = round(monthlyPremium);

  // 6. Process fees (+ optional enrollment contribution waiver)
  let enrollmentContributionMeta: QuoteMetadata['enrollmentContribution'];

  if (plan.fees) {
    for (const fee of plan.fees) {
      if (!fee.enabled) continue;

      if (fee.id === 'enrollment-contribution' && opts?.enrollmentContribution) {
        const resolved = resolveEnrollmentContribution({
          ...opts.enrollmentContribution,
          amount: opts.enrollmentContribution.amount ?? fee.amount,
        });
        enrollmentContributionMeta = resolved;
        if (resolved.listAmount > 0) {
          breakdown.push({
            label: 'Enrollment Contribution (list)',
            amount: resolved.listAmount,
            meta: { feeId: fee.id },
          });
        }
        if (resolved.waiverAmount > 0) {
          breakdown.push({
            label: 'Founding Member Waiver',
            amount: -resolved.waiverAmount,
            meta: { feeId: fee.id, founding: true },
          });
        }
        oneTimeFees.push({
          id: fee.id,
          label: fee.label,
          amount: resolved.netAmount,
          meta: {
            listAmount: resolved.listAmount,
            waiverAmount: resolved.waiverAmount,
            foundingWaiverApplied: resolved.foundingWaiverApplied,
            ...(resolved.splits ? { splits: resolved.splits } : {}),
          },
        });
        continue;
      }

      if (fee.id === 'enrollment-contribution') {
        // No policy passed — charge list amount from fee line as-is
        oneTimeFees.push({ id: fee.id, label: fee.label, amount: fee.amount });
        continue;
      }

      if (fee.type === 'flat_monthly') {
        monthlyFees.push({ id: fee.id, label: fee.label, amount: fee.amount });
      } else if (fee.type === 'flat_one_time') {
        oneTimeFees.push({ id: fee.id, label: fee.label, amount: fee.amount });
      } else if (fee.type === 'percent') {
        const pctAmount = round(monthlyPremium * (fee.amount / 100));
        if (fee.applies_to === 'quote') {
          monthlyFees.push({ id: fee.id, label: fee.label, amount: pctAmount });
        } else {
          oneTimeFees.push({ id: fee.id, label: fee.label, amount: pctAmount });
        }
      }
    }
  }

  const totalMonthlyFees = monthlyFees.reduce((s, f) => s + f.amount, 0);
  const totalMonthly = round(monthlyPremium + totalMonthlyFees);

  const metadata: QuoteMetadata = {
    planId: plan.planId,
    planName: plan.displayName,
    coverageTier: input.coverageTier,
    rateSetUsed: rateSetKey,
    rateSetLabel: rateSet.label,
    effectiveDate: rateSet.effective_date,
    ratingModel: plan.rating_model,
    ageRatingBasis: plan.age_rating_basis ?? 'primary',
    marketSegment: plan.market_segment,
    provisional: plan.provisional,
    ratingAge,
    bandsUsed,
    ...(enrollmentContributionMeta
      ? { enrollmentContribution: enrollmentContributionMeta }
      : {}),
  };

  return {
    monthlyPremium,
    monthlyFees,
    totalMonthly,
    oneTimeFees,
    breakdown,
    metadata,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

/**
 * Return available plan options for a given rate set.
 */
export function getPlanOptions(
  config: RateConfig,
  rateSet?: RateSetKey
): PlanOption[] {
  const key = rateSet ?? 'current';
  const set = config.rate_sets[key];
  return set.plans.map((plan) => ({
    planId: plan.planId,
    displayName: plan.displayName,
    ratingModel: plan.rating_model,
    coverageTiers: plan.coverage_tiers,
    ageBands: plan.age_bands,
    ageRatingBasis: plan.age_rating_basis,
    marketSegment: plan.market_segment,
    iuaAmount: plan.iua_amount,
    provisional: plan.provisional,
  }));
}

/**
 * Build a matrix preview for display purposes.
 * For additive_person, derives a display matrix with default assumptions.
 */
export function buildMatrixPreview(
  config: RateConfig,
  planId: string,
  rateSet?: RateSetKey
): MatrixPreview | null {
  const key = rateSet ?? 'current';
  const set = config.rate_sets[key];
  const plan = set.plans.find((p) => p.planId === planId);
  if (!plan) return null;

  const footnotes: string[] = [];
  let matrix: { [coverageTier: string]: { [ageBandId: string]: number } };

  if (plan.rating_model === 'tiered_household') {
    matrix = buildTieredMatrix(plan);
    if (plan.age_rating_basis === 'older_of_couple') {
      footnotes.push(
        'Individual couple pricing (Member + Spouse / Family) uses the age of the older spouse.'
      );
    } else if (plan.market_segment === 'group') {
      footnotes.push('Group pricing is based on the employee\'s age.');
    }
    if (plan.provisional) {
      footnotes.push(
        'Provisional rates — partnership (doctor/nurse) costs and wellness lab panel are not included.'
      );
    }
  } else {
    matrix = buildAdditiveMatrix(plan, footnotes);
  }

  return {
    planId: plan.planId,
    displayName: plan.displayName,
    ratingModel: plan.rating_model,
    rateSetKey: key,
    rateSetLabel: set.label,
    effectiveDate: set.effective_date,
    ageBands: plan.age_bands,
    coverageTiers: plan.coverage_tiers,
    matrix,
    ageRatingBasis: plan.age_rating_basis,
    marketSegment: plan.market_segment,
    provisional: plan.provisional,
    ...(footnotes.length > 0 ? { footnotes } : {}),
  };
}

// ──────────────────────────────────────────────
// Rate Set Resolution
// ──────────────────────────────────────────────

export function resolveRateSetKey(
  config: RateConfig,
  coverageStart: string,
  override?: RateSetKey
): RateSetKey {
  if (override) return override;
  const startDate = new Date(coverageStart);
  const cutoff = new Date('2026-01-01');
  const preferred: RateSetKey = startDate >= cutoff ? 'rates_2026' : 'current';
  if ((config.rate_sets[preferred]?.plans?.length ?? 0) > 0) return preferred;
  const fallback: RateSetKey = preferred === 'rates_2026' ? 'current' : 'rates_2026';
  return (config.rate_sets[fallback]?.plans?.length ?? 0) > 0 ? fallback : preferred;
}

// ──────────────────────────────────────────────
// Band Selection
// ──────────────────────────────────────────────

export function findAgeBand(
  ageBands: AgeBand[],
  age: number
): AgeBand | undefined {
  return ageBands.find((band) => age >= band.min && age <= band.max);
}

/**
 * Resolve the age used for tiered household band lookup.
 */
export function resolveRatingAge(
  basis: AgeRatingBasis | undefined,
  coverageTier: CoverageTier,
  household: QuoteInput['household']
): { age: number; errors: QuoteError[] } {
  const errors: QuoteError[] = [];
  const useOlder =
    (basis ?? 'primary') === 'older_of_couple' &&
    (coverageTier === 'member_spouse' || coverageTier === 'family');

  if (useOlder) {
    if (household.spouseAge === undefined || household.spouseAge === null) {
      errors.push({
        code: 'MISSING_SPOUSE_AGE',
        message: 'Spouse age is required for older-of-couple rating',
        path: 'household.spouseAge',
      });
      return { age: household.memberAge, errors };
    }
    return { age: Math.max(household.memberAge, household.spouseAge), errors };
  }

  return { age: household.memberAge, errors };
}

// ──────────────────────────────────────────────
// Tiered Household Calculation
// ──────────────────────────────────────────────

function calcTieredHousehold(
  plan: Plan,
  input: QuoteInput,
  bandsUsed: QuoteMetadata['bandsUsed']
): { premium: number; breakdown: BreakdownLine[]; errors: QuoteError[]; ratingAge?: number } {
  const errors: QuoteError[] = [];
  const breakdown: BreakdownLine[] = [];

  const { age: ratingAge, errors: ageErrors } = resolveRatingAge(
    plan.age_rating_basis,
    input.coverageTier,
    input.household
  );
  if (ageErrors.length > 0) {
    return { premium: 0, breakdown, errors: ageErrors };
  }

  const ratingBand = findAgeBand(plan.age_bands, ratingAge);
  if (!ratingBand) {
    errors.push({
      code: 'NO_AGE_BAND',
      message: `No age band found for rating age ${ratingAge}`,
      path: 'household.memberAge',
    });
    return { premium: 0, breakdown, errors };
  }

  const memberBand = findAgeBand(plan.age_bands, input.household.memberAge);
  bandsUsed.memberBand = memberBand?.id;
  bandsUsed.ratingBand = ratingBand.id;
  if (
    input.household.spouseAge !== undefined &&
    input.household.spouseAge !== null
  ) {
    bandsUsed.spouseBand = findAgeBand(plan.age_bands, input.household.spouseAge)?.id;
  }

  const rates = plan.rates as TieredHouseholdRates;
  const tierRates = rates[input.coverageTier];
  if (!tierRates) {
    errors.push({
      code: 'NO_TIER_RATES',
      message: `No rates found for coverage tier "${input.coverageTier}"`,
      path: 'coverageTier',
    });
    return { premium: 0, breakdown, errors };
  }

  const rate = tierRates[ratingBand.id];
  if (rate === undefined || rate === null) {
    errors.push({
      code: 'NO_RATE',
      message: `No rate for tier "${input.coverageTier}" and band "${ratingBand.id}"`,
      path: `rates.${input.coverageTier}.${ratingBand.id}`,
    });
    return { premium: 0, breakdown, errors };
  }

  const basisLabel =
    plan.age_rating_basis === 'older_of_couple' &&
    (input.coverageTier === 'member_spouse' || input.coverageTier === 'family')
      ? `older of couple, age ${ratingAge}`
      : `age ${ratingAge}`;

  breakdown.push({
    label: `${input.coverageTier} (${ratingBand.label}; ${basisLabel})`,
    amount: round(rate),
    meta: {
      tier: input.coverageTier,
      band: ratingBand.id,
      ratingAge,
      ageRatingBasis: plan.age_rating_basis ?? 'primary',
    },
  });

  return { premium: round(rate), breakdown, errors, ratingAge };
}

// ──────────────────────────────────────────────
// Additive Person Calculation
// ──────────────────────────────────────────────

function calcAdditivePerson(
  plan: Plan,
  input: QuoteInput,
  bandsUsed: QuoteMetadata['bandsUsed'],
  opts?: QuoteOptions
): { premium: number; breakdown: BreakdownLine[]; errors: QuoteError[] } {
  const errors: QuoteError[] = [];
  const breakdown: BreakdownLine[] = [];
  let premium = 0;

  const rates = plan.rates as AdditivePersonRates;

  const memberBand = findAgeBand(plan.age_bands, input.household.memberAge);
  if (!memberBand) {
    errors.push({
      code: 'NO_AGE_BAND',
      message: `No age band found for member age ${input.household.memberAge}`,
      path: 'household.memberAge',
    });
    return { premium: 0, breakdown, errors };
  }
  bandsUsed.memberBand = memberBand.id;

  const subscriberRate = rates.subscriber[memberBand.id];
  if (subscriberRate === undefined || subscriberRate === null) {
    errors.push({
      code: 'NO_RATE',
      message: `No subscriber rate for band "${memberBand.id}"`,
      path: `rates.subscriber.${memberBand.id}`,
    });
    return { premium: 0, breakdown, errors };
  }

  premium += subscriberRate;
  breakdown.push({
    label: `Subscriber (${memberBand.label})`,
    amount: round(subscriberRate),
    meta: { person: 'subscriber', band: memberBand.id },
  });

  if (input.coverageTier === 'member_spouse' || input.coverageTier === 'family') {
    if (rates.spouse_adder) {
      const spouseResult = resolveAdder(
        rates.spouse_adder,
        plan.age_bands,
        input.household.spouseAge,
        'spouse',
        bandsUsed
      );
      if (spouseResult.error) {
        errors.push(spouseResult.error);
      } else {
        premium += spouseResult.amount;
        breakdown.push({
          label: spouseResult.label,
          amount: round(spouseResult.amount),
          meta: { person: 'spouse', band: spouseResult.bandId },
        });
      }
    }
  }

  if (input.coverageTier === 'member_children' || input.coverageTier === 'family') {
    const depAges = input.household.dependentAges ?? [];
    const maxPriced =
      opts?.dependentsPricedOverride ?? rates.max_dependents_priced ?? depAges.length;
    const pricedCount = Math.min(depAges.length, maxPriced);
    const depBands: string[] = [];

    if (rates.dependent_adder) {
      for (let i = 0; i < pricedCount; i++) {
        const depResult = resolveAdder(
          rates.dependent_adder,
          plan.age_bands,
          depAges[i],
          `dependent_${i + 1}`,
          {}
        );
        if (depResult.error) {
          errors.push(depResult.error);
        } else {
          premium += depResult.amount;
          breakdown.push({
            label: depResult.label,
            amount: round(depResult.amount),
            meta: { person: `dependent_${i + 1}`, band: depResult.bandId, age: depAges[i] },
          });
          if (depResult.bandId) depBands.push(depResult.bandId);
        }
      }
    }

    if (depBands.length > 0) {
      bandsUsed.dependentBands = depBands;
    }
  }

  return { premium: round(premium), breakdown, errors };
}

// ──────────────────────────────────────────────
// Adder Resolution (flat or banded)
// ──────────────────────────────────────────────

function resolveAdder(
  adder: { [ageBandId: string]: number } | { flat: number },
  ageBands: AgeBand[],
  age: number | undefined,
  personLabel: string,
  bandsUsed: Record<string, unknown>
): { amount: number; label: string; bandId?: string; error?: QuoteError } {
  if ('flat' in adder) {
    return {
      amount: (adder as { flat: number }).flat,
      label: `${capitalize(personLabel)} adder (flat)`,
    };
  }

  if (age === undefined || age === null) {
    return {
      amount: 0,
      label: '',
      error: {
        code: 'MISSING_AGE',
        message: `Age required for ${personLabel} but not provided`,
        path: `household.${personLabel}Age`,
      },
    };
  }

  const band = findAgeBand(ageBands, age);
  if (!band) {
    return {
      amount: 0,
      label: '',
      error: {
        code: 'NO_AGE_BAND',
        message: `No age band found for ${personLabel} age ${age}`,
        path: `household.${personLabel}Age`,
      },
    };
  }

  const bandedRates = adder as { [ageBandId: string]: number };
  const rate = bandedRates[band.id];
  if (rate === undefined || rate === null) {
    return {
      amount: 0,
      label: '',
      error: {
        code: 'NO_RATE',
        message: `No rate for ${personLabel} band "${band.id}"`,
        path: `rates.${personLabel}_adder.${band.id}`,
      },
    };
  }

  const key = personLabel.includes('dependent') ? undefined : `${personLabel}Band`;
  if (key) {
    (bandsUsed as Record<string, string>)[key] = band.id;
  }

  return {
    amount: rate,
    label: `${capitalize(personLabel)} adder (${band.label})`,
    bandId: band.id,
  };
}

// ──────────────────────────────────────────────
// Matrix Builders
// ──────────────────────────────────────────────

function buildTieredMatrix(
  plan: Plan
): { [coverageTier: string]: { [ageBandId: string]: number } } {
  const rates = plan.rates as TieredHouseholdRates;
  const matrix: { [coverageTier: string]: { [ageBandId: string]: number } } = {};

  for (const tier of plan.coverage_tiers) {
    matrix[tier] = {};
    for (const band of plan.age_bands) {
      matrix[tier][band.id] = rates[tier]?.[band.id] ?? 0;
    }
  }

  return matrix;
}

function buildAdditiveMatrix(
  plan: Plan,
  footnotes: string[]
): { [coverageTier: string]: { [ageBandId: string]: number } } {
  const rates = plan.rates as AdditivePersonRates;
  const matrix: { [coverageTier: string]: { [ageBandId: string]: number } } = {};

  for (const tier of plan.coverage_tiers) {
    matrix[tier] = {};
    for (const band of plan.age_bands) {
      const sub = rates.subscriber[band.id] ?? 0;
      let total = sub;

      if (tier === 'member_spouse' || tier === 'family') {
        total += getAdderAmount(rates.spouse_adder, band.id);
      }

      if (tier === 'member_children') {
        total += getAdderAmount(rates.dependent_adder, band.id) * 1;
      }

      if (tier === 'family') {
        total += getAdderAmount(rates.dependent_adder, band.id) * 2;
      }

      matrix[tier][band.id] = round(total);
    }
  }

  footnotes.push(
    'Member + Children preview assumes 1 dependent at the same age band.',
    'Family preview assumes spouse at the same age band + 2 dependents at the same age band.',
    'Use the quote calculator for exact pricing based on actual ages.'
  );

  return matrix;
}

function getAdderAmount(
  adder: { [ageBandId: string]: number } | { flat: number } | undefined,
  ageBandId: string
): number {
  if (!adder) return 0;
  if ('flat' in adder) return (adder as { flat: number }).flat;
  return (adder as { [ageBandId: string]: number })[ageBandId] ?? 0;
}

// ──────────────────────────────────────────────
// Coverage Tier Household Validation
// ──────────────────────────────────────────────

function validateCoverageTierHousehold(input: QuoteInput): QuoteError[] {
  const errors: QuoteError[] = [];
  const { coverageTier, household } = input;

  if (coverageTier === 'member_spouse' || coverageTier === 'family') {
    if (household.spouseAge === undefined || household.spouseAge === null) {
      errors.push({
        code: 'MISSING_SPOUSE_AGE',
        message: `Spouse age is required for coverage tier "${coverageTier}"`,
        path: 'household.spouseAge',
      });
    }
  }

  if (coverageTier === 'member_children' || coverageTier === 'family') {
    if (!household.dependentAges || household.dependentAges.length === 0) {
      errors.push({
        code: 'MISSING_DEPENDENTS',
        message: `At least one dependent is required for coverage tier "${coverageTier}"`,
        path: 'household.dependentAges',
      });
    }
  }

  return errors;
}

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function getSubscriberPremiumFromBreakdown(breakdown: BreakdownLine[]): number {
  const sub = breakdown.find(
    (b) =>
      (b.meta as Record<string, unknown>)?.person === 'subscriber' ||
      b.label.toLowerCase().includes('subscriber') ||
      (b.meta as Record<string, unknown>)?.tier === 'member'
  );
  return sub?.amount ?? 0;
}

function errorResult(
  rateSetKey: RateSetKey,
  rateSet: RateSet,
  input: QuoteInput,
  errors: QuoteError[],
  plan?: Plan
): QuoteResult {
  return {
    monthlyPremium: 0,
    monthlyFees: [],
    totalMonthly: 0,
    oneTimeFees: [],
    breakdown: [],
    metadata: {
      planId: input.planId,
      planName: plan?.displayName ?? input.planId,
      coverageTier: input.coverageTier,
      rateSetUsed: rateSetKey,
      rateSetLabel: rateSet.label,
      effectiveDate: rateSet.effective_date,
      ratingModel: plan?.rating_model ?? 'tiered_household',
      ageRatingBasis: plan?.age_rating_basis,
      marketSegment: plan?.market_segment,
      provisional: plan?.provisional,
      bandsUsed: {},
    },
    errors,
  };
}
