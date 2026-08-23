import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@crm-eco/lib/rate-limit';
import { resolveRateQuery, summarizeResultSlice } from '@crm-eco/cash-pay';
import { getRateDataPaged } from '@crm-eco/cash-pay/server';
import { requirePinUnlock } from '@/lib/require-pin';

export const dynamic = 'force-dynamic';

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * GET /api/rates — HCL proxy after PIN unlock. Never exposes HCL_SECRET_KEY.
 */
export async function GET(request: NextRequest) {
  const locked = requirePinUnlock(request);
  if (locked) return locked;

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
  const query = resolveRateQuery({
    zip: searchParams.get('zip'),
    state: searchParams.get('state'),
    msa: searchParams.get('msa'),
    specialty: searchParams.get('specialty'),
  });

  if (!query.ok) {
    const status = query.code === 'invalid_input' ? 400 : 404;
    return NextResponse.json({ error: query.code, message: query.message }, { status });
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
    stateName: query.stateName,
    msaName: query.msaName,
    specialty: query.specialty,
    pageNumber: result.pageNumber,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
    hasMore: result.hasMore,
    slice: summarizeResultSlice(result.rates, result.totalCount),
    rates: result.rates,
  });
}
