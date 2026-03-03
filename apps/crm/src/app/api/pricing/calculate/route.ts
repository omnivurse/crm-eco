import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

const calculateSchema = z.object({
  plan_code: z.string().min(1),
  age: z.number().int().min(0).max(120),
  rating_area_code: z.string().min(1),
  tobacco: z.boolean().default(false),
  year: z.number().int().min(2024).max(2030).default(2025),
  benefit_tier: z.string().optional(),
});

/**
 * GET /api/pricing/calculate
 * Public-safe pricing calculation endpoint.
 * Returns monthly premium for a given plan, age, area, tobacco status, and year.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;

    const parsed = calculateSchema.safeParse({
      plan_code: searchParams.get('plan_code'),
      age: Number(searchParams.get('age')),
      rating_area_code: searchParams.get('rating_area_code') || 'DEFAULT-001',
      tobacco: searchParams.get('tobacco') === 'true',
      year: Number(searchParams.get('year') || '2025'),
      benefit_tier: searchParams.get('benefit_tier') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { plan_code, age, rating_area_code, tobacco, year, benefit_tier } = parsed.data;

    const supabase = await createClient();

    // Call the calculate_premium RPC
    const { data, error } = await supabase.rpc('calculate_premium', {
      p_plan_code: plan_code,
      p_age: age,
      p_rating_area_code: rating_area_code,
      p_tobacco: tobacco,
      p_year: year,
      p_benefit_tier: benefit_tier || null,
    });

    if (error) {
      console.error('Premium calculation error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to calculate premium' },
        { status: 400 }
      );
    }

    const monthlyPremium = data as number;

    // Fetch plan details for response enrichment
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, brand_name, category, metal_tier, description')
      .or(`plan_code.eq.${plan_code},code.eq.${plan_code}`)
      .eq('is_active', true)
      .single();

    // Fetch benefit details if healthshare
    let benefitSummary: Record<string, unknown> = {};
    if (plan?.category === 'healthshare') {
      const { data: hsConfig } = await supabase
        .from('plan_healthshare_config')
        .select('*')
        .eq('plan_id', plan.id)
        .single();
      if (hsConfig) {
        benefitSummary = {
          individual_share_amount: hsConfig.individual_share_amount,
          family_share_amount: hsConfig.family_share_amount,
          annual_unshared_amount: hsConfig.annual_unshared_amount,
          max_sharing_limit: hsConfig.max_sharing_limit,
          telehealth_included: hsConfig.telehealth_included,
          maternity_included: hsConfig.maternity_included,
          rx_discount_included: hsConfig.rx_discount_included,
          network_type: hsConfig.network_type,
        };
      }
    } else if (plan?.category === 'traditional') {
      const { data: tradConfig } = await supabase
        .from('plan_traditional_config')
        .select('*')
        .eq('plan_id', plan.id)
        .single();
      if (tradConfig) {
        benefitSummary = {
          deductible_individual: tradConfig.deductible_individual,
          deductible_family: tradConfig.deductible_family,
          oop_max_individual: tradConfig.oop_max_individual,
          oop_max_family: tradConfig.oop_max_family,
          coinsurance_percent: tradConfig.coinsurance_percent,
          primary_care_copay: tradConfig.primary_care_copay,
          specialist_copay: tradConfig.specialist_copay,
          er_copay: tradConfig.er_copay,
          rx_generic_copay: tradConfig.rx_generic_copay,
          rx_brand_copay: tradConfig.rx_brand_copay,
          hsa_eligible: tradConfig.hsa_eligible,
          network_type: tradConfig.network_type,
        };
      }
    }

    // Get tier info if requested
    let tierInfo: Record<string, unknown> | null = null;
    if (benefit_tier && plan) {
      const { data: tierData } = await supabase
        .from('plan_benefit_matrix')
        .select(`
          premium_modifier,
          fixed_adjustment,
          benefit_tiers!inner(tier_code, display_name, description)
        `)
        .eq('plan_id', plan.id)
        .eq('benefit_tiers.tier_code', benefit_tier)
        .eq('active', true)
        .single();

      if (tierData) {
        const bt = tierData.benefit_tiers as unknown as {
          tier_code: string;
          display_name: string;
          description: string;
        };
        tierInfo = {
          tier_code: bt.tier_code,
          tier_name: bt.display_name,
          tier_description: bt.description,
          modifier: tierData.premium_modifier,
          adjustment: tierData.fixed_adjustment,
        };
      }
    }

    return NextResponse.json({
      plan: plan ? {
        plan_code,
        name: plan.name,
        brand_name: plan.brand_name,
        category: plan.category,
        metal_tier: plan.metal_tier,
        description: plan.description,
      } : null,
      tier: tierInfo,
      pricing: {
        monthly_premium: monthlyPremium,
        annual_premium: Math.round(monthlyPremium * 12 * 100) / 100,
        age,
        rating_area: rating_area_code,
        tobacco,
        year,
      },
      benefit_summary: benefitSummary,
    });
  } catch (error) {
    console.error('Error in GET /api/pricing/calculate:', error);
    return NextResponse.json(
      { error: 'Failed to calculate premium' },
      { status: 500 }
    );
  }
}
