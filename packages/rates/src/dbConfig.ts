// ──────────────────────────────────────────────
// DB → RateConfig builder
// Shared by admin /api/rates/config and /api/rates/quote.
// Reads plan_rate_sets (+ joined plan_rate_entries / plan_fees) rows
// and assembles a canonical E123 RateConfig the engine can quote against.
// ──────────────────────────────────────────────
import type {
  RateConfig,
  Plan,
  AgeBand,
  FeeLine,
  TieredHouseholdRates,
  AdditivePersonRates,
  CoverageTier,
  RatingModel,
} from './types';

export function buildRateConfigFromDb(rows: any[]): RateConfig {
  const currentPlans: Plan[] = [];
  const futurePlans: Plan[] = [];
  let currentLabel = 'Current Rates';
  let currentDate = '2025-01-01';
  let futureLabel = '2026 Rates';
  let futureDate = '2026-01-01';

  for (const row of rows) {
    const plan = dbRowToPlan(row);

    if (row.rate_set_key === 'current') {
      currentPlans.push(plan);
      currentLabel = row.label || currentLabel;
      currentDate = row.effective_date || currentDate;
    } else {
      futurePlans.push(plan);
      futureLabel = row.label || futureLabel;
      futureDate = row.effective_date || futureDate;
    }
  }

  return {
    meta: {
      currency: 'USD',
      updated_at: new Date().toISOString(),
    },
    rate_sets: {
      current: { label: currentLabel, effective_date: currentDate, plans: currentPlans },
      rates_2026: { label: futureLabel, effective_date: futureDate, plans: futurePlans },
    },
  };
}

function dbRowToPlan(row: any): Plan {
  const ageBands: AgeBand[] = (row.age_bands || []).map((b: any) => ({
    id: b.id,
    min: b.min,
    max: b.max,
    label: b.label,
  }));

  const ratingModel: RatingModel = row.rating_model || 'tiered_household';
  const coverageTiers: CoverageTier[] = ['member', 'member_spouse', 'member_children', 'family'];

  const fees: FeeLine[] = (row.fees || []).map((f: any) => ({
    id: f.id,
    label: f.label,
    type: f.fee_type,
    amount: Number(f.amount),
    applies_to: f.applies_to,
    enabled: f.enabled,
  }));

  const tobacco = row.tobacco_config || { enabled: false };
  const entries = row.entries || [];

  let rates: TieredHouseholdRates | AdditivePersonRates;
  if (ratingModel === 'tiered_household') {
    rates = buildTieredRatesFromEntries(entries);
  } else {
    rates = buildAdditiveRatesFromEntries(entries, row.max_dependents_priced ?? undefined);
  }

  return {
    planId: row.plan?.code || row.plan_id,
    displayName: row.plan?.name || row.plan_id,
    rating_model: ratingModel,
    age_bands: ageBands,
    coverage_tiers: coverageTiers,
    tobacco,
    fees: fees.length > 0 ? fees : undefined,
    rates,
  };
}

function buildTieredRatesFromEntries(entries: any[]): TieredHouseholdRates {
  const rates: TieredHouseholdRates = {};
  for (const e of entries) {
    if (!rates[e.coverage_tier]) rates[e.coverage_tier] = {};
    rates[e.coverage_tier][e.age_band_id] = Number(e.amount);
  }
  return rates;
}

function buildAdditiveRatesFromEntries(
  entries: any[],
  maxDependentsPriced?: number
): AdditivePersonRates {
  const rates: AdditivePersonRates = { subscriber: {} };

  for (const e of entries) {
    const pt = e.person_type || e.coverage_tier;

    if (pt === 'subscriber') {
      rates.subscriber[e.age_band_id] = Number(e.amount);
    } else if (pt === 'spouse_adder') {
      if (e.rate_type === 'flat') {
        rates.spouse_adder = { flat: Number(e.amount) };
      } else {
        if (!rates.spouse_adder || 'flat' in rates.spouse_adder) {
          rates.spouse_adder = {};
        }
        (rates.spouse_adder as Record<string, number>)[e.age_band_id] = Number(e.amount);
      }
    } else if (pt === 'dependent_adder') {
      if (e.rate_type === 'flat') {
        rates.dependent_adder = { flat: Number(e.amount) };
      } else {
        if (!rates.dependent_adder || 'flat' in rates.dependent_adder) {
          rates.dependent_adder = {};
        }
        (rates.dependent_adder as Record<string, number>)[e.age_band_id] = Number(e.amount);
      }
    }
  }

  if (maxDependentsPriced !== undefined) {
    rates.max_dependents_priced = maxDependentsPriced;
  }

  return rates;
}
