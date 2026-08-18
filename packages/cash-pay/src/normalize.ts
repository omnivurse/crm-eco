import type { CashRateRow, HclPagedResponse, HclRawRate, CashPayErrorCode } from './types';
import { catalogDefaultHclName } from './specialties';

export function defaultSpecialty(): string {
  return catalogDefaultHclName();
}

export function normalizeRate(raw: HclRawRate): CashRateRow | null {
  const rate = typeof raw.rate === 'number' ? raw.rate : Number(raw.rate);
  if (!Number.isFinite(rate)) return null;
  const facilityName = (raw.facilityName || '').trim();
  if (!facilityName) return null;

  return {
    id: raw.id ?? `${facilityName}-${raw.procedureCode ?? ''}-${rate}`,
    hospitalId: raw.hospitalID ?? raw.hospitalId ?? null,
    facilityName,
    city: (raw.cityName || raw.location || '').trim(),
    state: (raw.stateName || '').trim(),
    procedureCode: (raw.procedureCode || '').trim(),
    codeDescription: (raw.codeDescription || '').trim(),
    category: (raw.category || '').trim(),
    rate,
    paymentMethod: raw.paymentMethod?.trim() || null,
    carrier: raw.carrier?.trim() || null,
    planName: raw.planName?.trim() || null,
    lob: raw.lob?.trim() || null,
    product: raw.product?.trim() || null,
    cmsRelativity:
      typeof raw.cmsRelativity === 'number' && Number.isFinite(raw.cmsRelativity)
        ? raw.cmsRelativity
        : null,
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
  if (lower.includes('no table mapping') || lower.includes('msa')) {
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
