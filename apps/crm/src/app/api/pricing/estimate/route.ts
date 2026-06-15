import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { generatePricingEstimate, suggestProcedureCodes } from '@/lib/pricing/estimator';
import type { PricingInput } from '@/lib/pricing/types';

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
    const profile = await getAuthProfile();
    if (!profile) {
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

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Load need from crm_records (needs detail module) — member state from JSONB, not embed
    const { data: need, error } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', needId)
      .eq('org_id', profile.organization_id)
      .single();

    if (error || !need) {
      return NextResponse.json({ error: 'Need not found' }, { status: 404 });
    }

    const needData =
      need.data && typeof need.data === 'object'
        ? (need.data as Record<string, unknown>)
        : {};

    // Build pricing input from need data
    const input: PricingInput = {
      needType: (needData.need_type as string) || (needData.type as string) || 'medical',
      description: (needData.description as string) || need.title || '',
      procedureCodes: (needData.procedure_codes as string[]) || [],
      facilityType: needData.facility_type as PricingInput['facilityType'],
      facilityName: needData.facility_name as string | undefined,
      inNetwork: needData.in_network as boolean | undefined,
      memberState: (needData.member_state as string) || undefined,
      billedAmount: parseFloat(String(needData.billed_amount ?? '')) || undefined,
      incidentDate: needData.incident_date as string | undefined,
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
