import { NextResponse } from 'next/server';
import { quote, buildRateConfigFromDb } from '@crm-eco/rates';
import type { CoverageTier } from '@crm-eco/rates/types';
import { requireCrmApiKey } from '@/lib/public-api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireCrmApiKey(request, 'read');
  if ('error' in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    planId?: string;
    coverageTier?: CoverageTier;
    memberAge?: number;
    spouseAge?: number;
    dependentAges?: number[];
    coverageStart?: string;
  } | null;
  if (!body?.planId || body.memberAge == null) {
    return NextResponse.json({ error: 'planId and memberAge are required' }, { status: 400 });
  }

  const { data: rateSets, error } = await auth.supabase
    .from('plan_rate_sets')
    .select(`
      *,
      plan:plans!inner(id, name, code, organization_id, iua_amount, metadata),
      entries:plan_rate_entries(*),
      fees:plan_fees(*)
    `)
    .eq('plan.organization_id', auth.key.organization_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = quote(buildRateConfigFromDb((rateSets ?? []) as Parameters<typeof buildRateConfigFromDb>[0]), {
    planId: body.planId,
    coverageTier: body.coverageTier || 'member',
    household: {
      memberAge: body.memberAge,
      ...(body.spouseAge != null ? { spouseAge: body.spouseAge } : {}),
      ...(body.dependentAges?.length ? { dependentAges: body.dependentAges } : {}),
    },
    coverageStart: body.coverageStart || new Date().toISOString().slice(0, 10),
  });
  return NextResponse.json({ quote: result });
}
