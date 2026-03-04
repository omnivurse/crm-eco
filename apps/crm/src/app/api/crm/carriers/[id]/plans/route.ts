import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/carriers/[id]/plans
 * List plans for a specific carrier
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const metalLevel = searchParams.get('metal_level');
    const planType = searchParams.get('plan_type');

    let query = supabase
      .from('insurance_plans')
      .select('*')
      .eq('carrier_id', id)
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('base_premium', { ascending: true });

    if (metalLevel) {
      query = query.eq('metal_level', metalLevel);
    }
    if (planType) {
      query = query.eq('plan_type', planType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CarrierPlans GET]', error);
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('[CarrierPlans GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createPlanSchema = z.object({
  plan_name: z.string().min(1).max(255),
  plan_type: z.enum(['insurance', 'healthshare', 'medicaid', 'short_term']).default('insurance'),
  metal_level: z.enum(['catastrophic', 'bronze', 'silver', 'gold', 'platinum']).nullable().optional(),
  base_premium: z.number().min(0).optional(),
  tax_credit_estimate: z.number().min(0).optional(),
  deductible: z.number().min(0).optional(),
  max_out_of_pocket: z.number().min(0).optional(),
  copay_primary: z.number().min(0).optional(),
  copay_specialist: z.number().min(0).optional(),
  rx_coverage: z.boolean().optional(),
  dental_included: z.boolean().optional(),
  vision_included: z.boolean().optional(),
  hsa_eligible: z.boolean().optional(),
  plan_year: z.number().int().optional(),
  summary_url: z.string().url().optional(),
});

/**
 * POST /api/crm/carriers/[id]/plans
 * Add a plan to a carrier
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('insurance_plans')
      .insert({
        organization_id: profile.organization_id,
        carrier_id: id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      console.error('[CarrierPlans POST]', error);
      return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[CarrierPlans POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
