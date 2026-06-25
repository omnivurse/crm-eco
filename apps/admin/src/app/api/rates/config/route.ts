import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireAdminRole } from '@/lib/auth';
import { getActiveTenant } from '@/lib/tenant';
import { buildRateConfigFromDb } from '@crm-eco/rates';

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

    // Replace rate entries atomically (DELETE + INSERT in a single SQL tx)
    // so a failed insert can't leave an empty rate set in production.
    if (rates && rateSet) {
      const builtEntries = buildRateEntries(rateSet.id, ratingModel, rates);
      // Strip rate_set_id from each entry — the RPC adds it itself.
      const rpcEntries = builtEntries.map(({ rate_set_id: _ignored, ...rest }) => rest);
      const { error: entryErr } = await (supabase as any).rpc('replace_plan_rate_entries', {
        p_rate_set_id: rateSet.id,
        p_entries: rpcEntries,
      });
      if (entryErr) {
        return NextResponse.json({ error: entryErr.message }, { status: 500 });
      }
    }

    // Replace fees atomically.
    if (fees && rateSet) {
      const feeRows =
        fees.length > 0
          ? fees.map((f: any, i: number) => ({
              label: f.label,
              fee_type: f.type || f.fee_type,
              amount: f.amount,
              applies_to: f.applies_to || 'quote',
              enabled: f.enabled ?? true,
              sort_order: i,
            }))
          : [];
      const { error: feeErr } = await (supabase as any).rpc('replace_plan_fees', {
        p_rate_set_id: rateSet.id,
        p_fees: feeRows,
      });
      if (feeErr) {
        return NextResponse.json({ error: feeErr.message }, { status: 500 });
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
// NOTE: buildRateConfigFromDb (the DB → RateConfig read path, incl.
// dbRowToPlan / buildTieredRatesFromEntries / buildAdditiveRatesFromEntries)
// now lives in @crm-eco/rates so the config + quote routes share one builder.

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
