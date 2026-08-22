import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@crm-eco/lib/rate-limit';
import {
  loadHclCatalog,
  loadSpecialtyCatalogFromEnv,
  resolvePreferredMarket,
  specialtiesForSearch,
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

/** Public catalog meta. Never exposes HCL_SECRET_KEY. */
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
  const allowlist = loadHclCatalog();
  const zip = searchParams.get('zip')?.trim() || '';
  const preferred = resolvePreferredMarket({
    allowlist,
    zip,
    state: searchParams.get('state'),
  });
  const specialties = specialtiesForSearch(loadSpecialtyCatalogFromEnv(), allowlist);

  return NextResponse.json({
    states: uniqueStates(allowlist),
    msas: uniqueMsas(allowlist),
    specialties,
    preferredState: preferred.stateName,
    preferredMsa: preferred.msaName,
    preferredZip: preferred.zip || zip,
    defaultSpecialty: specialties[0]?.hclName || 'Hospital cash prices',
  });
}
