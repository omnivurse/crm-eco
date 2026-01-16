import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { generatePricingEstimate, suggestProcedureCodes } from '@/lib/pricing/estimator';
import type { PricingInput } from '@/lib/pricing/types';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

const pricingInputSchema = z.object({
  needType: z.string(),
  description: z.string().optional(),
  procedureCodes: z.array(z.string()).optional(),
  facilityType: z.enum(['hospital', 'urgent_care', 'clinic', 'specialist', 'imaging', 'lab', 'pharmacy', 'other']).optional(),
  facilityName: z.string().optional(),
  inNetwork: z.boolean().optional(),
  memberState: z.string().optional(),
  billedAmount: z.number().optional(),
  incidentDate: z.string().optional(),
});

/**
 * POST /api/pricing/estimate
 * Generate a pricing estimate for a healthcare need
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = pricingInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const input: PricingInput = parsed.data;

    // If no procedure codes but we have a description, suggest some
    let suggestedCodes: string[] = [];
    if ((!input.procedureCodes || input.procedureCodes.length === 0) && input.description) {
      suggestedCodes = suggestProcedureCodes(input.description);
    }

    // Generate the estimate
    const estimate = await generatePricingEstimate(input);

    return NextResponse.json({
      estimate,
      suggestedCodes,
      input,
    });
  } catch (error) {
    console.error('Pricing estimate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/pricing/estimate?needId=xxx
 * Get pricing estimate for an existing need
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const needId = searchParams.get('needId');

    if (!needId) {
      return NextResponse.json({ error: 'needId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the need record
    const { data: need, error } = await supabase
      .from('crm_records')
      .select('*, members(state)')
      .eq('id', needId)
      .eq('org_id', profile.organization_id)
      .single();

    if (error || !need) {
      return NextResponse.json({ error: 'Need not found' }, { status: 404 });
    }

    // Build pricing input from need data
    const input: PricingInput = {
      needType: need.data?.need_type || need.data?.type || 'medical',
      description: need.data?.description || need.title || '',
      procedureCodes: need.data?.procedure_codes || [],
      facilityType: need.data?.facility_type,
      facilityName: need.data?.facility_name,
      inNetwork: need.data?.in_network,
      memberState: need.members?.state || need.data?.member_state,
      billedAmount: parseFloat(need.data?.billed_amount) || undefined,
      incidentDate: need.data?.incident_date,
    };

    // Suggest codes if none provided
    let suggestedCodes: string[] = [];
    if ((!input.procedureCodes || input.procedureCodes.length === 0) && input.description) {
      suggestedCodes = suggestProcedureCodes(input.description);
    }

    // Generate estimate
    const estimate = await generatePricingEstimate(input);

    // Check if we already have a stored estimate
    const { data: existingEstimate } = await supabase
      .from('need_pricing_estimates')
      .select('*')
      .eq('need_id', needId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      estimate,
      suggestedCodes,
      input,
      storedEstimate: existingEstimate || null,
    });
  } catch (error) {
    console.error('Pricing estimate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
