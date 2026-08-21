import { NextRequest, NextResponse } from 'next/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit } from '@/lib/api/guard';
import {
  getRateDataPaged,
  loadMsaAllowlistFromEnv,
  loadSpecialtyCatalogFromEnv,
  msasForState,
  normalizeStateName,
  pickPreferredState,
  resolveSpecialty,
  specialtiesForSearch,
  stateFromZip,
  uniqueMsas,
  uniqueStates,
} from '@crm-eco/cash-pay';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pricing/hcl
 * Auth: active membership. Proxies Health Cost Labs GetRateDataPaged.
 * Never exposes HCL_SECRET_KEY to the browser.
 *
 * Query: zip?, state?, msa?, procedureCode?, category?, page?, pageSize?
 * Meta: ?meta=1 returns allowlisted states/MSAs for the search UI.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const limited = memberRateLimit(ctx.member.id, 'pricing-hcl', { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const { searchParams } = request.nextUrl;
  const allowlist = loadMsaAllowlistFromEnv();

  if (searchParams.get('meta') === '1') {
    const zip = searchParams.get('zip')?.trim() || '';
    const requestedState = normalizeStateName(searchParams.get('state') || undefined);
    const inferred = zip ? stateFromZip(zip) : null;
    const memberState = normalizeStateName(
      (ctx.member as { state?: string | null }).state || undefined,
    );
    const preferredState = pickPreferredState(allowlist, [
      requestedState,
      inferred,
      memberState,
    ]);
    const specialties = specialtiesForSearch(loadSpecialtyCatalogFromEnv(), allowlist);
    return NextResponse.json(
      {
        states: uniqueStates(allowlist),
        /** Unique metros. Specialty list is allowlist-scoped. */
        msas: uniqueMsas(allowlist),
        specialties,
        preferredState,
        preferredZip: (ctx.member as { zip?: string | null }).zip || zip || '',
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

  const zip = searchParams.get('zip')?.trim() || '';
  if (zip && !/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Valid 5-digit ZIP code required' },
      { status: 400, headers: limited.headers },
    );
  }

  const stateParam = normalizeStateName(searchParams.get('state') || undefined);
  const stateName =
    stateParam || (zip ? stateFromZip(zip) : null) ||
    normalizeStateName((ctx.member as { state?: string | null }).state || undefined);

  const msaName = searchParams.get('msa')?.trim() || '';
  if (!stateName || !msaName) {
    return NextResponse.json(
      {
        error: 'invalid_input',
        message: 'State and metro area (MSA) are required for cash-price search.',
      },
      { status: 400, headers: limited.headers },
    );
  }

  const allowed = msasForState(allowlist, stateName).find(
    (e) => e.msaName.trim().toLowerCase() === msaName.toLowerCase(),
  );
  if (allowlist.length > 0 && !allowed) {
    return NextResponse.json(
      {
        error: 'no_msa_mapping',
        message: 'This metro area is not enabled for your organization yet.',
        fallback: true,
      },
      { status: 404, headers: limited.headers },
    );
  }

  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || '25') || 25));
  const procedureCode = searchParams.get('procedureCode')?.trim() || undefined;
  const category = searchParams.get('category')?.trim() || undefined;
  const specialty = resolveSpecialty(allowed, searchParams.get('specialty'));

  const result = await getRateDataPaged({
    stateName,
    msaName: allowed?.msaName || msaName,
    specialty,
    pageNumber: page,
    pageSize,
    procedureCode,
    category,
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
        // Backup directory only when this metro is not on the key.
        fallback: result.code === 'no_msa_mapping',
      },
      { status, headers: limited.headers },
    );
  }

  return NextResponse.json(
    {
      source: 'hcl',
      stateName,
      msaName: allowed?.msaName || msaName,
      specialty,
      pageNumber: result.pageNumber,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      rates: result.rates,
    },
    { headers: limited.headers },
  );
}
