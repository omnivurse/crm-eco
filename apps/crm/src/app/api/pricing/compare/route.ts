import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

const compareSchema = z.object({
  plan_codes: z.array(z.string().min(1)).min(1).max(20),
  age: z.number().int().min(0).max(120),
  rating_area_code: z.string().min(1),
  tobacco: z.boolean().default(false),
  year: z.number().int().min(2024).max(2030).default(2025),
  benefit_tier: z.string().optional(),
  include_all_tiers: z.boolean().default(false),
});

/**
 * POST /api/pricing/compare
 * Compare premiums across multiple plans.
 * Supports tier comparison and full benefit breakdowns.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = compareSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { plan_codes, age, rating_area_code, tobacco, year, benefit_tier, include_all_tiers } = parsed.data;

    const supabase = await createClient();

    // If include_all_tiers, we need to calculate for each tier
    if (include_all_tiers) {
      const { data: tiers } = await supabase
        .from('benefit_tiers')
        .select('tier_code, display_name')
        .eq('is_active', true)
        .order('sort_order');

      const tierResults: Record<string, unknown[]> = {};

      for (const tier of (tiers || [])) {
        const { data, error } = await supabase.rpc('compare_premiums', {
          p_plan_codes: plan_codes,
          p_age: age,
          p_rating_area_code: rating_area_code,
          p_tobacco: tobacco,
          p_year: year,
          p_benefit_tier: tier.tier_code,
        });

        if (!error && data) {
          tierResults[tier.tier_code] = (data as unknown[]).map((row: unknown) => {
            const r = row as Record<string, unknown>;
            return {
              plan_code: r.plan_code,
              plan_name: r.plan_name,
              brand_name: r.brand_name,
              category: r.category,
              metal_tier: r.metal_tier,
              benefit_tier: tier.tier_code,
              tier_display_name: tier.display_name,
              monthly_premium: r.monthly_premium,
              annual_premium: r.annual_premium,
            };
          });
        }
      }

      return NextResponse.json({
        comparison_type: 'all_tiers',
        parameters: { plan_codes, age, rating_area_code, tobacco, year },
        tiers: tierResults,
      });
    }

    // Single tier (or no tier) comparison
    const { data, error } = await supabase.rpc('compare_premiums', {
      p_plan_codes: plan_codes,
      p_age: age,
      p_rating_area_code: rating_area_code,
      p_tobacco: tobacco,
      p_year: year,
      p_benefit_tier: benefit_tier || null,
    });

    if (error) {
      console.error('Compare premiums error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to compare premiums' },
        { status: 400 }
      );
    }

    // Enrich with benefit summaries
    const results = [];
    for (const row of (data as unknown[]) || []) {
      const r = row as Record<string, unknown>;
      const planCode = r.plan_code as string;

      // Fetch plan benefits
      const { data: plan } = await supabase
        .from('plans')
        .select('id, category, description')
        .or(`plan_code.eq.${planCode},code.eq.${planCode}`)
        .eq('is_active', true)
        .single();

      let benefitHighlights: string[] = [];
      let shareAmount: number | null = null;

      if (plan?.category === 'healthshare') {
        const { data: hs } = await supabase
          .from('plan_healthshare_config')
          .select('*')
          .eq('plan_id', plan.id)
          .single();
        if (hs) {
          shareAmount = hs.individual_share_amount;
          benefitHighlights = [
            `Annual Unshared: $${hs.annual_unshared_amount}`,
            hs.telehealth_included ? 'Telehealth Included' : '',
            hs.maternity_included ? 'Maternity Included' : '',
            hs.rx_discount_included ? 'Rx Discount Included' : '',
            hs.network_type ? `${hs.network_type} Network` : '',
          ].filter(Boolean);
        }
      } else if (plan?.category === 'traditional') {
        const { data: trad } = await supabase
          .from('plan_traditional_config')
          .select('*')
          .eq('plan_id', plan.id)
          .single();
        if (trad) {
          benefitHighlights = [
            `Deductible: $${trad.deductible_individual}`,
            `OOP Max: $${trad.oop_max_individual}`,
            `Coinsurance: ${trad.coinsurance_percent}%`,
            `PCP Copay: $${trad.primary_care_copay}`,
            trad.hsa_eligible ? 'HSA Eligible' : '',
            trad.network_type ? `${trad.network_type} Network` : '',
          ].filter(Boolean);
        }
      }

      results.push({
        plan_code: planCode,
        plan_name: r.plan_name,
        brand_name: r.brand_name,
        category: r.category,
        metal_tier: r.metal_tier,
        benefit_tier: benefit_tier || null,
        monthly_premium: r.monthly_premium,
        annual_premium: r.annual_premium,
        share_amount: shareAmount,
        benefit_highlights: benefitHighlights,
        description: plan?.description || null,
      });
    }

    return NextResponse.json({
      comparison_type: 'single',
      parameters: { plan_codes, age, rating_area_code, tobacco, year, benefit_tier },
      results,
    });
  } catch (error) {
    console.error('Error in POST /api/pricing/compare:', error);
    return NextResponse.json(
      { error: 'Failed to compare premiums' },
      { status: 500 }
    );
  }
}
