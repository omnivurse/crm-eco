import type { RateClipSnapshot } from '@crm-eco/cash-pay';

export interface RateBookRecord {
  id: string;
  organization_id: string;
  member_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RateClipRecord {
  id: string;
  organization_id: string;
  member_id: string;
  rate_book_id: string;
  hcl_rate_id: string;
  hospital_id: number | null;
  facility_name: string;
  city: string | null;
  state: string | null;
  procedure_code: string;
  code_description: string | null;
  category: string | null;
  rate: number;
  payment_method: string | null;
  cms_relativity: number | null;
  query_state_name: string | null;
  query_msa_name: string | null;
  query_specialty: string | null;
  slice_high: number | null;
  slice_median: number | null;
  file_size: number | null;
  notes: string | null;
  clipped_at: string;
  created_at: string;
  updated_at: string;
}

export interface ClipInput {
  id: number | string;
  hospitalId?: number | null;
  facilityName: string;
  city?: string | null;
  state?: string | null;
  procedureCode: string;
  codeDescription?: string | null;
  category?: string | null;
  rate: number;
  paymentMethod?: string | null;
  cmsRelativity?: number | null;
  queryStateName?: string | null;
  queryMsaName?: string | null;
  querySpecialty?: string | null;
  sliceHigh?: number | null;
  sliceMedian?: number | null;
  fileSize?: number | null;
}

export function clipRecordToSnapshot(row: RateClipRecord): RateClipSnapshot & { clipId: string } {
  return {
    clipId: row.id,
    id: row.hcl_rate_id,
    hospitalId: row.hospital_id,
    facilityName: row.facility_name,
    city: row.city ?? '',
    state: row.state ?? '',
    msaName: row.query_msa_name ?? null,
    procedureCode: row.procedure_code,
    codeDescription: row.code_description ?? '',
    category: row.category ?? '',
    rate: Number(row.rate),
    paymentMethod: row.payment_method,
    carrier: null,
    planName: null,
    lob: null,
    product: null,
    cmsRelativity: row.cms_relativity == null ? null : Number(row.cms_relativity),
    codeType: null,
    cmsRate: null,
    grossCharges: null,
    address: null,
    zip: null,
    phone: null,
    website: null,
    npi: null,
    latitude: null,
    longitude: null,
    hospitalType: null,
    healthsystemType: null,
    corporateEntity: null,
    additionalPayerNotes: null,
    methodology: null,
    queryStateName: row.query_state_name ?? '',
    queryMsaName: row.query_msa_name ?? '',
    querySpecialty: row.query_specialty ?? '',
    clippedAt: row.clipped_at,
    sliceHigh: row.slice_high == null ? null : Number(row.slice_high),
    sliceMedian: row.slice_median == null ? null : Number(row.slice_median),
    fileSize: row.file_size == null ? null : Number(row.file_size),
  };
}

export function parseClipInput(raw: unknown): ClipInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const id = b.id;
  const facilityName = typeof b.facilityName === 'string' ? b.facilityName.trim() : '';
  const procedureCode = typeof b.procedureCode === 'string' ? b.procedureCode.trim() : '';
  const rate = typeof b.rate === 'number' ? b.rate : Number(b.rate);
  if (id == null || id === '') return null;
  if (!facilityName || !procedureCode) return null;
  if (!Number.isFinite(rate) || rate < 0) return null;
  return {
    id: id as number | string,
    hospitalId: typeof b.hospitalId === 'number' ? b.hospitalId : b.hospitalId == null ? null : Number(b.hospitalId) || null,
    facilityName,
    city: typeof b.city === 'string' ? b.city : null,
    state: typeof b.state === 'string' ? b.state : null,
    procedureCode,
    codeDescription: typeof b.codeDescription === 'string' ? b.codeDescription : null,
    category: typeof b.category === 'string' ? b.category : null,
    rate,
    paymentMethod: typeof b.paymentMethod === 'string' ? b.paymentMethod : null,
    cmsRelativity:
      typeof b.cmsRelativity === 'number' && Number.isFinite(b.cmsRelativity)
        ? b.cmsRelativity
        : null,
    queryStateName: typeof b.queryStateName === 'string' ? b.queryStateName : null,
    queryMsaName: typeof b.queryMsaName === 'string' ? b.queryMsaName : null,
    querySpecialty: typeof b.querySpecialty === 'string' ? b.querySpecialty : null,
    sliceHigh: typeof b.sliceHigh === 'number' && Number.isFinite(b.sliceHigh) ? b.sliceHigh : null,
    sliceMedian:
      typeof b.sliceMedian === 'number' && Number.isFinite(b.sliceMedian) ? b.sliceMedian : null,
    fileSize: typeof b.fileSize === 'number' && Number.isFinite(b.fileSize) ? b.fileSize : null,
  };
}
