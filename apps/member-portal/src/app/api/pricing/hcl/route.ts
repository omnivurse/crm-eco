import { NextRequest, NextResponse } from 'next/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit } from '@/lib/api/guard';
import {
  loadHclCatalog,
  loadSpecialtyCatalogFromEnv,
  resolvePreferredMarket,
  resolveRateQuery,
  specialtiesForSearch,
  summarizeResultSlice,
  uniqueMsas,
  uniqueStates,
} from '@crm-eco/cash-pay';
import { getRateDataPaged } from '@crm-eco/cash-pay/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pricing/hcl
 * Auth: active membership. Proxies Health Cost Labs GetRateDataPaged.
 * Never exposes HCL_SECRET_KEY to the browser.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const limited = memberRateLimit(ctx.member.id, 'pricing-hcl', { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const { searchParams } = request.nextUrl;
  const allowlist = loadHclCatalog();

  if (searchParams.get('meta') === '1') {
    const zip = searchParams.get('zip')?.trim() || '';
    const memberState = (ctx.member as { state?: string | null }).state || undefined;
    const preferred = resolvePreferredMarket({
      allowlist,
      zip,
      state: searchParams.get('state'),
      extraCandidates: [memberState],
    });
    const specialties = specialtiesForSearch(loadSpecialtyCatalogFromEnv(), allowlist);
    return NextResponse.json(
      {
        states: uniqueStates(allowlist),
        msas: uniqueMsas(allowlist),
        specialties,
        preferredState: preferred.stateName,
        preferredMsa: preferred.msaName,
        preferredZip: (ctx.member as { zip?: string | null }).zip || preferred.zip || zip,
        defaultSpecialty: specialties[0]?.hclName || 'Hospital cash prices',
      },
      { headers: limited.headers },
    );
  }

  if (allowlist.length === 0) {
    return NextResponse.json(
      {
        error: 'misconfigured',
        message: 'Price lookup is not configured.',
        fallback: false,
      },
      { status: 503, headers: limited.headers },
    );
  }

  const query = resolveRateQuery({
    allowlist,
    zip: searchParams.get('zip'),
    state: searchParams.get('state') || (ctx.member as { state?: string | null }).state,
    msa: searchParams.get('msa'),
    specialty: searchParams.get('specialty'),
  });

  if (!query.ok) {
    return NextResponse.json(
      {
        error: query.code,
        message: query.message,
        fallback: query.code === 'no_msa_mapping',
      },
      { status: query.code === 'invalid_input' ? 400 : 404, headers: limited.headers },
    );
  }

  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || '50') || 50));
  const procedureCode = searchParams.get('procedureCode')?.trim() || undefined;
  const category = searchParams.get('category')?.trim() || undefined;
  const hospitalIdRaw = searchParams.get('hospitalId');
  const hospitalId = hospitalIdRaw ? Number(hospitalIdRaw) : undefined;

  const result = await getRateDataPaged({
    stateName: query.stateName,
    msaName: query.msaName,
    specialty: query.specialty,
    pageNumber: page,
    pageSize,
    procedureCode,
    category,
    hospitalId: Number.isFinite(hospitalId) ? hospitalId : undefined,
  });

  if (!result.ok) {
    const status =
      result.code === 'invalid_key' || result.code === 'misconfigured'
        ? 503
        : result.code === 'no_msa_mapping' || result.code === 'empty'
          ? 404
          : result.code === 'invalid_input'
            ? 400
            : 502;
    return NextResponse.json(
      {
        error: result.code,
        message: result.message,
        fallback:
          result.code === 'no_msa_mapping' ||
          result.code === 'misconfigured' ||
          result.code === 'invalid_key',
      },
      { status, headers: limited.headers },
    );
  }

  return NextResponse.json(
    {
      source: 'hcl',
      stateName: query.stateName,
      msaName: query.msaName,
      specialty: query.specialty,
      pageNumber: result.pageNumber,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      slice: summarizeResultSlice(result.rates, result.totalCount),
      rates: result.rates,
    },
    { headers: limited.headers },
  );
}
