import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@crm-eco/lib/rate-limit';
import {
  getRateDataPaged,
  loadMsaAllowlistFromEnv,
  msasForState,
  normalizeStateName,
  resolveSpecialty,
  hclStateForZip,
} from '@crm-eco/cash-pay';

export const dynamic = 'force-dynamic';

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * GET /api/rates — public HCL proxy. Never exposes HCL_SECRET_KEY.
 * Until Leo provisions the Expose key, returns a mapped error (not 500).
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(`cashpay-rates:${clientIp(request)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Try again shortly.' },
      { status: 429 },
    );
  }

  const { searchParams } = request.nextUrl;
  const allowlist = loadMsaAllowlistFromEnv();
  const zip = searchParams.get('zip')?.trim() || '';

  if (zip && !/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Valid 5-digit ZIP code required' },
      { status: 400 },
    );
  }

  const stateParam = normalizeStateName(searchParams.get('state') || undefined);
  const stateName = stateParam || (zip ? hclStateForZip(zip) : null);
  const msaName = searchParams.get('msa')?.trim() || '';

  if (!stateName || !msaName) {
    return NextResponse.json(
      {
        error: 'invalid_input',
        message: 'State and metro area (MSA) are required.',
      },
      { status: 400 },
    );
  }

  const allowed = msasForState(allowlist, stateName).find(
    (e) => e.msaName.trim().toLowerCase() === msaName.toLowerCase(),
  );
  if (allowlist.length > 0 && !allowed) {
    return NextResponse.json(
      {
        error: 'no_msa_mapping',
        message: 'This metro area is not in the published file yet.',
      },
      { status: 404 },
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
    const publicMessage =
      result.code === 'invalid_key' || result.code === 'misconfigured'
        ? 'Live rates are not available yet for this environment.'
        : result.code === 'no_msa_mapping' || result.code === 'empty'
          ? result.message.replace(' or use backup search.', '.')
          : result.message;
    const status =
      result.code === 'invalid_key' || result.code === 'misconfigured'
        ? 503
        : result.code === 'no_msa_mapping' || result.code === 'empty'
          ? 404
          : result.code === 'invalid_input'
            ? 400
            : 502;
    return NextResponse.json({ error: result.code, message: publicMessage }, { status });
  }

  return NextResponse.json({
    source: 'hcl',
    stateName,
    msaName: allowed?.msaName || msaName,
    specialty,
    pageNumber: result.pageNumber,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
    hasMore: result.hasMore,
    rates: result.rates,
  });
}
