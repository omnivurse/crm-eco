import type { CashRateRow, HclPagedResponse, HclRawRate, CashPayErrorCode } from './types';
import { catalogDefaultHclName } from './specialties';

export function defaultSpecialty(): string {
  return catalogDefaultHclName();
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '');
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function asText(...candidates: unknown[]): string {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

export function normalizeRate(raw: HclRawRate): CashRateRow | null {
  const rate = asNumber(raw.rate);
  if (rate == null) return null;
  const facilityName = asText(raw.facilityName);
  if (!facilityName) return null;

  return {
    id: raw.id ?? `${facilityName}-${asText(raw.procedureCode)}-${rate}`,
    hospitalId: asNumber(raw.hospitalID ?? raw.hospitalId),
    facilityName,
    city: asText(raw.cityName, raw.location),
    state: asText(raw.stateName),
    msaName: asText(raw.msaName) || null,
    procedureCode: asText(raw.procedureCode),
    codeDescription: asText(raw.codeDescription),
    category: asText(raw.category),
    codeType: asText(raw.codeType) || null,
    rate,
    paymentMethod: asText(raw.paymentMethod) || null,
    carrier: asText(raw.carrier) || null,
    planName: asText(raw.planName) || null,
    lob: asText(raw.lob) || null,
    product: asText(raw.product) || null,
    cmsRelativity: asNumber(raw.cmsRelativity),
    cmsRate: asNumber(raw.cmsRate),
    grossCharges: asNumber(raw.grossCharges),
    address: asText(raw.address) || null,
    zip: asText(raw.zip) || null,
    phone: asText(raw.phone) || null,
    website: asText(raw.website) || null,
    npi: asText(raw.npi) || null,
    latitude: asNumber(raw.latitude),
    longitude: asNumber(raw.longitude),
    hospitalType: asText(raw.hospitalType) || null,
    healthsystemType: asText(raw.healthsystemType) || null,
    corporateEntity: asText(raw.corporateEntity) || null,
    additionalPayerNotes: asText(raw.additionalPayerNotes) || null,
    methodology: asText(raw.methodology) || null,
  };
}

export function mapHclError(msg: string | undefined, httpStatus?: number): CashPayErrorCode {
  const lower = (msg || '').toLowerCase();
  if (
    httpStatus === 401 ||
    lower.includes('invalid secret key') ||
    lower.includes('invalid secret')
  ) {
    return 'invalid_key';
  }
  if (
    lower.includes('no table mapping') ||
    lower.includes('could not find stored procedure') ||
    lower.includes('stored procedure')
  ) {
    return 'no_msa_mapping';
  }
  return 'upstream';
}

export function parseHclPagedBody(
  data: HclPagedResponse,
  httpStatus: number,
): {
  ok: boolean;
  code?: CashPayErrorCode;
  message?: string;
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  rates: CashRateRow[];
} {
  const msg = data.msg || data.message || '';
  if (data.success === false || httpStatus >= 400) {
    const code = mapHclError(msg, httpStatus);
    return {
      ok: false,
      code,
      message: userMessageForCode(code),
      pageNumber: 1,
      pageSize: 25,
      totalCount: 0,
      hasMore: false,
      rates: [],
    };
  }

  const rates = (data.ratesList || [])
    .map(normalizeRate)
    .filter((r): r is CashRateRow => r !== null);

  const totalCount = typeof data.totalCount === 'number' ? data.totalCount : rates.length;
  const pageNumber = typeof data.pageNumber === 'number' ? data.pageNumber : 1;
  const pageSize = typeof data.pageSize === 'number' ? data.pageSize : 25;
  const hasMore =
    typeof data.hasMore === 'boolean'
      ? data.hasMore
      : pageNumber * pageSize < totalCount;

  if (rates.length === 0 && totalCount === 0) {
    return {
      ok: false,
      code: 'empty',
      message: userMessageForCode('empty'),
      pageNumber,
      pageSize,
      totalCount: 0,
      hasMore: false,
      rates: [],
    };
  }

  return {
    ok: true,
    pageNumber,
    pageSize,
    totalCount,
    hasMore,
    rates,
  };
}

export function userMessageForCode(code: CashPayErrorCode): string {
  switch (code) {
    case 'invalid_key':
      return 'Price lookup is temporarily unavailable. Try again later or use our backup search.';
    case 'no_msa_mapping':
      return 'This area or specialty is not in the published file yet. Try another metro, hospital, or RX search.';
    case 'empty':
      return 'No published cash prices matched that search.';
    case 'misconfigured':
      return 'Price lookup is not configured.';
    case 'invalid_input':
      return 'Check ZIP, metro area, and procedure code, then try again.';
    case 'upstream':
    default:
      return 'The price service did not respond. Please try again in a moment.';
  }
}
