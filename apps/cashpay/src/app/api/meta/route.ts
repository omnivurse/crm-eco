import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@crm-eco/lib/rate-limit';
import {
  loadMsaAllowlistFromEnv,
  loadSpecialtyCatalogFromEnv,
  normalizeStateName,
  pickPreferredState,
  specialtiesForSearch,
  hclStateForZip,
  uniqueMsas,
  uniqueStates,
} from '@crm-eco/cash-pay';

export const dynamic = 'force-dynamic';

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** Public allowlist meta for Cash Pay search UI. Never exposes HCL_SECRET_KEY. */
export async function GET(request: NextRequest) {
  const limited = rateLimit(`cashpay-meta:${clientIp(request)}`, {
    limit: 60,
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
  const requestedState = normalizeStateName(searchParams.get('state') || undefined);
  const inferred = zip && /^\d{5}$/.test(zip) ? hclStateForZip(zip) : null;
  const preferredState = pickPreferredState(allowlist, [requestedState, inferred]);

  const specialties = specialtiesForSearch(loadSpecialtyCatalogFromEnv(), allowlist);
  return NextResponse.json({
    states: uniqueStates(allowlist),
    msas: uniqueMsas(allowlist),
    specialties,
    preferredState,
    preferredZip: zip,
    defaultSpecialty: specialties[0]?.hclName || 'Hospital cash prices',
  });
}
