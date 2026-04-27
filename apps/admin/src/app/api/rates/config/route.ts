import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireAdminRole } from '@/lib/auth';
import { getActiveTenant } from '@/lib/tenant';
import type {
  RateConfig,
  RateSet,
  Plan,
  AgeBand,
  FeeLine,
  TieredHouseholdRates,
  AdditivePersonRates,
  CoverageTier,
  RatingModel,
  RateSetKey,
} from '@crm-eco/rates/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rates/config
 * Load the full E123 RateConfig from the database for a given plan (or all plans).
 * Query params: ?planId=xxx (optional, filters to one plan)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = request.nextUrl;

    const { profile, error: authError } = await requireAdminRole(supabase);
    if (authError) return authError;

    const planIdFilter = searchParams.get('planId');

    let rateSetsQuery = (supabase as any)
      .from('plan_rate_sets')
      .select(`
        *,
        plan:plans!inner(id, name, code, organization_id),
        entries:plan_rate_entries(*),
        fees:plan_fees(*)
      `)
      .eq('plan.organization_id', profile.organization_id);

    if (planIdFilter) {
      rateSetsQuery = rateSetsQuery.eq('plan_id', planIdFilter);
    }

    const { data: rateSets, error } = await rateSetsQuery;

    if (error) {
      console.error('Error fetching rate config:', error);
      return NextResponse.json({ error: 'Failed to fetch rate configuration' }, { status: 500 });
    }

    const config = buildRateConfigFromDb(rateSets ?? []);
    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rates/config
 * Save/upsert a plan's rate set data. Body: { planId, rateSetKey, ratingModel, ageBands, rates, fees, tobacco }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const tenant = await getActiveTenant();
    if (!tenant || !['owner', 'admin'].includes(tenant.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      planId,
      rateSetKey,
      label,
      effectiveDate,
      ratingModel,
      ageBands,
      tobaccoConfig,
      maxDependentsPriced,
      rates,
      fees,
    } = body;

    if (!planId || !rateSetKey) {
      return NextResponse.json({ error: 'planId and rateSetKey are required' }, { status: 400 });
    }

    // Verify plan belongs to org
    const { data: plan } = await supabase
      .from('plans')
      .select('id, organization_id')
      .eq('id', planId)
      .eq('organization_id', tenant.organizationId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Upsert rate set
    const { data: rateSet, error: rsError } = await (supabase as any)
      .from('plan_rate_sets')
      .upsert(
        {
          plan_id: planId,
          rate_set_key: rateSetKey,
          label: label || `${rateSetKey} rates`,
          effective_date: effectiveDate,
          rating_model: ratingModel || 'tiered_household',
          age_bands: ageBands || [],
          tobacco_config: tobaccoConfig || { enabled: false },
          max_dependents_priced: maxDependentsPriced ?? null,
        },
        { onConflict: 'plan_id,rate_set_key' }
      )
      .select()
      .single();

    if (rsError) {
      return NextResponse.json({ error: rsError.message }, { status: 500 });
    }

    // Replace rate entries
    if (rates && rateSet) {
      await (supabase as any)
        .from('plan_rate_entries')
        .delete()
        .eq('rate_set_id', rateSet.id);

      const entries = buildRateEntries(rateSet.id, ratingModel, rates);
      if (entries.length > 0) {
        const { error: entryErr } = await (supabase as any)
          .from('plan_rate_entries')
          .insert(entries);
        if (entryErr) {
          return NextResponse.json({ error: entryErr.message }, { status: 500 });
        }
      }
    }

    // Replace fees
    if (fees && rateSet) {
      await (supabase as any)
        .from('plan_fees')
        .delete()
        .eq('rate_set_id', rateSet.id);

      if (fees.length > 0) {
        const feeRows = fees.map((f: any, i: number) => ({
          rate_set_id: rateSet.id,
          label: f.label,
          fee_type: f.type || f.fee_type,
          amount: f.amount,
          applies_to: f.applies_to || 'quote',
          enabled: f.enabled ?? true,
          sort_order: i,
        }));

        const { error: feeErr } = await (supabase as any)
          .from('plan_fees')
          .insert(feeRows);
        if (feeErr) {
          return NextResponse.json({ error: feeErr.message }, { status: 500 });
        }
      }
    }

    // Update the plan's rating_model
    if (ratingModel) {
      await (supabase as any)
        .from('plans')
        .update({ rating_model: ratingModel })
        .eq('id', planId);
    }

    return NextResponse.json({ ok: true, rateSetId: rateSet?.id });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function buildRateConfigFromDb(rows: any[]): RateConfig {
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

function buildRateEntries(
  rateSetId: string,
  ratingModel: string,
  rates: any
): any[] {
  const entries: any[] = [];

  if (ratingModel === 'tiered_household') {
    for (const [tier, bands] of Object.entries(rates)) {
      if (typeof bands === 'object' && bands !== null) {
        for (const [bandId, amount] of Object.entries(bands as Record<string, number>)) {
          entries.push({
            rate_set_id: rateSetId,
            coverage_tier: tier,
            age_band_id: bandId,
            person_type: 'primary',
            rate_type: 'banded',
            amount: amount,
          });
        }
      }
    }
  } else {
    // additive_person
    if (rates.subscriber) {
      for (const [bandId, amount] of Object.entries(rates.subscriber as Record<string, number>)) {
        entries.push({
          rate_set_id: rateSetId,
          coverage_tier: 'subscriber',
          age_band_id: bandId,
          person_type: 'subscriber',
          rate_type: 'banded',
          amount,
        });
      }
    }
    if (rates.spouse_adder) {
      if ('flat' in rates.spouse_adder) {
        entries.push({
          rate_set_id: rateSetId,
          coverage_tier: 'spouse_adder',
          age_band_id: '_flat',
          person_type: 'spouse_adder',
          rate_type: 'flat',
          amount: rates.spouse_adder.flat,
        });
      } else {
        for (const [bandId, amount] of Object.entries(rates.spouse_adder as Record<string, number>)) {
          entries.push({
            rate_set_id: rateSetId,
            coverage_tier: 'spouse_adder',
            age_band_id: bandId,
            person_type: 'spouse_adder',
            rate_type: 'banded',
            amount,
          });
        }
      }
    }
    if (rates.dependent_adder) {
      if ('flat' in rates.dependent_adder) {
        entries.push({
          rate_set_id: rateSetId,
          coverage_tier: 'dependent_adder',
          age_band_id: '_flat',
          person_type: 'dependent_adder',
          rate_type: 'flat',
          amount: rates.dependent_adder.flat,
        });
      } else {
        for (const [bandId, amount] of Object.entries(rates.dependent_adder as Record<string, number>)) {
          entries.push({
            rate_set_id: rateSetId,
            coverage_tier: 'dependent_adder',
            age_band_id: bandId,
            person_type: 'dependent_adder',
            rate_type: 'banded',
            amount,
          });
        }
      }
    }
  }

  return entries;
}
