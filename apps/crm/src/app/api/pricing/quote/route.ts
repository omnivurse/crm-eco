import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

const createQuoteSchema = z.object({
  plan_code: z.string().min(1),
  age: z.number().int().min(0).max(120),
  rating_area_code: z.string().min(1).default('DEFAULT-001'),
  tobacco: z.boolean().default(false),
  year: z.number().int().default(2025),
  benefit_tier: z.string().optional(),
  // Recipient info
  contact_record_id: z.string().uuid().optional(),
  recipient_name: z.string().optional(),
  recipient_email: z.string().email().optional(),
  // Enrollment link
  enrollment_id: z.string().uuid().optional(),
});

/**
 * POST /api/pricing/quote
 * Create an immutable quote snapshot with full pricing and benefit breakdown.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createQuoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const params = parsed.data;
    const supabase = await createClient();

    // Calculate premium
    const { data: premium, error: calcError } = await supabase.rpc('calculate_premium', {
      p_plan_code: params.plan_code,
      p_age: params.age,
      p_rating_area_code: params.rating_area_code,
      p_tobacco: params.tobacco,
      p_year: params.year,
      p_benefit_tier: params.benefit_tier || null,
    });

    if (calcError || premium === null) {
      return NextResponse.json(
        { error: calcError?.message || 'Failed to calculate premium' },
        { status: 400 }
      );
    }

    const monthlyPremium = premium as number;

    // Fetch plan details
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, brand_name, plan_code, code, category, metal_tier')
      .or(`plan_code.eq.${params.plan_code},code.eq.${params.plan_code}`)
      .eq('is_active', true)
      .single();

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Get tier details
    let tierModifier = 1.0;
    let tierAdjustment = 0;
    let tierName: string | null = null;
    let benefitTierId: string | null = null;

    if (params.benefit_tier) {
      const { data: tierData } = await supabase
        .from('plan_benefit_matrix')
        .select(`
          id,
          premium_modifier,
          fixed_adjustment,
          benefit_tier_id,
          benefit_tiers!inner(tier_code, display_name)
        `)
        .eq('plan_id', plan.id)
        .eq('benefit_tiers.tier_code', params.benefit_tier)
        .eq('active', true)
        .single();

      if (tierData) {
        tierModifier = tierData.premium_modifier;
        tierAdjustment = tierData.fixed_adjustment;
        benefitTierId = tierData.benefit_tier_id;
        const bt = tierData.benefit_tiers as unknown as { display_name: string };
        tierName = bt.display_name;
      }
    }

    // Build full benefit breakdown
    const breakdown: Record<string, unknown> = {
      base_rate_before_tier: Math.round(monthlyPremium / tierModifier * 100) / 100,
      tier_modifier: tierModifier,
      tier_adjustment: tierAdjustment,
      tobacco: params.tobacco,
      tobacco_multiplier: params.tobacco ? 1.5 : 1.0,
      age: params.age,
      rating_area: params.rating_area_code,
      year: params.year,
    };

    // Fetch benefit config
    if (plan.category === 'healthshare') {
      const { data: hs } = await supabase
        .from('plan_healthshare_config')
        .select('*')
        .eq('plan_id', plan.id)
        .single();
      if (hs) breakdown.healthshare_benefits = hs;
    } else if (plan.category === 'traditional') {
      const { data: trad } = await supabase
        .from('plan_traditional_config')
        .select('*')
        .eq('plan_id', plan.id)
        .single();
      if (trad) breakdown.traditional_benefits = trad;
    }

    // Resolve advisor from profile
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id')
      .eq('profile_id', profile.id)
      .single();

    // Create immutable quote snapshot
    const { data: quote, error: insertError } = await supabase
      .from('quote_snapshots')
      .insert({
        organization_id: profile.organization_id,
        plan_id: plan.id,
        benefit_tier_id: benefitTierId,
        advisor_id: advisor?.id || null,
        contact_record_id: params.contact_record_id || null,
        enrollment_id: params.enrollment_id || null,
        recipient_name: params.recipient_name || null,
        recipient_email: params.recipient_email || null,
        recipient_age: params.age,
        recipient_state: params.rating_area_code.split('-')[0] || null,
        recipient_tobacco: params.tobacco,
        base_rate: Math.round(monthlyPremium / tierModifier * 100) / 100,
        tier_modifier: tierModifier,
        tier_adjustment: tierAdjustment,
        tobacco_multiplier: params.tobacco ? 1.5 : 1.0,
        final_monthly_premium: monthlyPremium,
        annual_premium: Math.round(monthlyPremium * 12 * 100) / 100,
        plan_code: plan.plan_code || plan.code,
        plan_name: plan.name,
        plan_category: plan.category,
        metal_tier: plan.metal_tier,
        benefit_tier_name: tierName,
        effective_year: params.year,
        rating_area_code: params.rating_area_code,
        breakdown,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select()
      .single();

    if (insertError) {
      console.error('Quote creation error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create quote' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      quote_id: quote.id,
      quote_number: quote.quote_number,
      plan: {
        plan_code: plan.plan_code || plan.code,
        name: plan.name,
        brand_name: plan.brand_name,
        category: plan.category,
        metal_tier: plan.metal_tier,
      },
      tier: tierName ? {
        tier_code: params.benefit_tier,
        tier_name: tierName,
        modifier: tierModifier,
        adjustment: tierAdjustment,
      } : null,
      pricing: {
        base_rate: quote.base_rate,
        modifier: quote.tier_modifier,
        final_rate: quote.final_monthly_premium,
        annual: quote.annual_premium,
      },
      benefit_summary: breakdown,
      expires_at: quote.expires_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/pricing/quote:', error);
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pricing/quote?id=<quote_id>
 * Retrieve an existing quote snapshot.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quoteId = request.nextUrl.searchParams.get('id');
    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: quote, error } = await supabase
      .from('quote_snapshots')
      .select('*')
      .eq('id', quoteId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Error in GET /api/pricing/quote:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}
