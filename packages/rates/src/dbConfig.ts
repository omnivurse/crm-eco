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
  AgeRatingBasis,
  MarketSegment,
  FeeType,
  FeeAppliesTo,
} from './types';

interface DbAgeBand {
  id: string;
  min: number;
  max: number;
  label: string;
}

interface DbFeeRow {
  id?: string;
  fee_key?: string | null;
  label: string;
  fee_type: FeeType;
  amount: number | string;
  applies_to: FeeAppliesTo;
  enabled: boolean;
  meta?: Record<string, unknown> | null;
}

interface DbRateEntry {
  coverage_tier: string;
  age_band_id: string;
  person_type?: string | null;
  rate_type?: string | null;
  amount: number | string;
}

interface DbPlanJoin {
  id?: string;
  name?: string | null;
  code?: string | null;
  organization_id?: string;
  iua_amount?: number | string | null;
  metadata?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
}

export interface DbRateSetRow {
  rate_set_key: string;
  label?: string | null;
  effective_date?: string | null;
  rating_model?: RatingModel | null;
  age_bands?: DbAgeBand[] | null;
  tobacco_config?: Plan['tobacco'] | null;
  max_dependents_priced?: number | null;
  age_rating_basis?: AgeRatingBasis | null;
  provisional?: boolean | null;
  plan_id?: string;
  plan?: DbPlanJoin | null;
  entries?: DbRateEntry[] | null;
  fees?: DbFeeRow[] | null;
}

export function buildRateConfigFromDb(rows: DbRateSetRow[]): RateConfig {
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

function dbRowToPlan(row: DbRateSetRow): Plan {
  const ageBands: AgeBand[] = (row.age_bands || []).map((b) => ({
    id: b.id,
    min: b.min,
    max: b.max,
    label: b.label,
  }));

  const ratingModel: RatingModel = row.rating_model || 'tiered_household';
  const coverageTiers: CoverageTier[] = ['member', 'member_spouse', 'member_children', 'family'];

  const fees: FeeLine[] = (row.fees || []).map((f) => ({
    id: f.fee_key || f.id || f.label,
    label: f.label,
    type: f.fee_type,
    amount: Number(f.amount),
    applies_to: f.applies_to,
    enabled: f.enabled,
    ...(f.meta ? { meta: f.meta } : {}),
  }));

  const tobacco = row.tobacco_config || { enabled: false };
  const entries = row.entries || [];

  const planMeta = (row.plan?.metadata || row.plan?.custom_fields || {}) as Record<
    string,
    unknown
  >;
  const ageRatingBasis: AgeRatingBasis =
    row.age_rating_basis ||
    (planMeta.age_rating_basis as AgeRatingBasis | undefined) ||
    (planMeta.market_segment === 'individual' ? 'older_of_couple' : 'primary');

  const marketSegment: MarketSegment | undefined =
    (planMeta.market_segment as MarketSegment | undefined) ||
    (typeof row.plan?.code === 'string' && row.plan.code.includes('-IND-')
      ? 'individual'
      : typeof row.plan?.code === 'string' && row.plan.code.includes('-GRP-')
        ? 'group'
        : undefined);

  let rates: TieredHouseholdRates | AdditivePersonRates;
  if (ratingModel === 'tiered_household') {
    rates = buildTieredRatesFromEntries(entries);
  } else {
    rates = buildAdditiveRatesFromEntries(entries, row.max_dependents_priced ?? undefined);
  }

  return {
    planId: row.plan?.code || row.plan_id || '',
    displayName: row.plan?.name || row.plan_id || '',
    rating_model: ratingModel,
    age_bands: ageBands,
    coverage_tiers: coverageTiers,
    age_rating_basis: ageRatingBasis,
    market_segment: marketSegment,
    iua_amount:
      row.plan?.iua_amount != null
        ? Number(row.plan.iua_amount)
        : planMeta.iua_amount != null
          ? Number(planMeta.iua_amount)
          : undefined,
    provisional: planMeta.provisional === true || row.provisional === true,
    tobacco,
    fees: fees.length > 0 ? fees : undefined,
    rates,
  };
}

function buildTieredRatesFromEntries(entries: DbRateEntry[]): TieredHouseholdRates {
  const rates: TieredHouseholdRates = {};
  for (const e of entries) {
    if (!rates[e.coverage_tier]) rates[e.coverage_tier] = {};
    rates[e.coverage_tier][e.age_band_id] = Number(e.amount);
  }
  return rates;
}

function buildAdditiveRatesFromEntries(
  entries: DbRateEntry[],
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
