import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  quote,
  buildRateConfigFromDb,
  enrollmentContributionFromSettings,
  fetchEnrollmentContributionSettings,
} from '@crm-eco/rates';
import type { CoverageTier, QuoteInput } from '@crm-eco/rates/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  planId: z.string().min(1),
  coverageTier: z.enum(['member', 'member_spouse', 'member_children', 'family']),
  memberAge: z.number().int().min(0).max(120),
  spouseAge: z.number().int().min(0).max(120).optional(),
  dependentAges: z.array(z.number().int().min(0).max(120)).optional(),
  coverageStart: z.string().min(4),
});

/**
 * POST /api/pricing/msa-quote
 * MSA / E123 rate-engine quote (not the legacy calculate_premium RPC).
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const params = parsed.data;
    const supabase = await createClient();
    const organizationId = (profile as { organization_id?: string }).organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 });
    }

    const { data: rateSets, error } = await (supabase as any)
      .from('plan_rate_sets')
      .select(
        `
        *,
        plan:plans!inner(id, name, code, organization_id, iua_amount, metadata),
        entries:plan_rate_entries(*),
        fees:plan_fees(*)
      `
      )
      .eq('plan.organization_id', organizationId)
      .eq('plan.code', params.planId);

    if (error) {
      console.error('msa-quote rate config error:', error);
      return NextResponse.json({ error: 'Failed to load rate configuration' }, { status: 500 });
    }

    if (!rateSets || rateSets.length === 0) {
      return NextResponse.json(
        { error: 'NO_RATE_SET', message: 'No MSA rate card found for this plan' },
        { status: 404 }
      );
    }

    const contribMap = await fetchEnrollmentContributionSettings(
      supabase as unknown,
      organizationId
    );
    const config = buildRateConfigFromDb(rateSets);
    const input: QuoteInput = {
      planId: params.planId,
      coverageTier: params.coverageTier as CoverageTier,
      household: {
        memberAge: params.memberAge,
        ...(params.spouseAge !== undefined ? { spouseAge: params.spouseAge } : {}),
        ...(params.dependentAges ? { dependentAges: params.dependentAges } : {}),
      },
      coverageStart: params.coverageStart,
    };

    const result = quote(config, input, {
      enrollmentContribution: enrollmentContributionFromSettings(contribMap),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('msa-quote error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
