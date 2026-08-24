/** Stable error codes returned to API routes / UI. Never leak Azure messages raw. */
export type CashPayErrorCode =
  | 'invalid_key'
  | 'no_msa_mapping'
  | 'empty'
  | 'upstream'
  | 'misconfigured'
  | 'invalid_input';

export interface MsaAllowlistEntry {
  stateName: string;
  msaName: string;
  /** Exact HCL specialty string (hospital, Pharmacy / RX, imaging, …). */
  specialty?: string;
}

export interface CashRateRow {
  id: number | string;
  hospitalId: number | null;
  facilityName: string;
  city: string;
  state: string;
  msaName: string | null;
  procedureCode: string;
  codeDescription: string;
  category: string;
  codeType: string | null;
  rate: number;
  paymentMethod: string | null;
  carrier: string | null;
  planName: string | null;
  lob: string | null;
  product: string | null;
  cmsRelativity: number | null;
  cmsRate: number | null;
  grossCharges: number | null;
  address: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  npi: string | null;
  latitude: number | null;
  longitude: number | null;
  hospitalType: string | null;
  healthsystemType: string | null;
  corporateEntity: string | null;
  additionalPayerNotes: string | null;
  methodology: string | null;
}

export interface GetRateDataPagedInput {
  stateName: string;
  msaName: string;
  specialty?: string;
  pageNumber?: number;
  pageSize?: number;
  procedureCode?: string;
  category?: string;
  hospitalId?: number;
  id?: string;
}

export interface GetRateDataPagedSuccess {
  ok: true;
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  rates: CashRateRow[];
  source: 'hcl';
}

export interface GetRateDataPagedFailure {
  ok: false;
  code: CashPayErrorCode;
  message: string;
}

export type GetRateDataPagedResult = GetRateDataPagedSuccess | GetRateDataPagedFailure;

/** Raw Azure ratesList item. Live 2026 file fills every named field below. */
export interface HclRawRate {
  id?: number | string;
  hospitalID?: number | string;
  hospitalId?: number | string;
  facilityName?: string;
  planName?: string;
  procedureCode?: string;
  cmsRelativity?: number | string;
  cmsRate?: number | string;
  grossCharges?: number | string;
  location?: string;
  paymentMethod?: string;
  carrier?: string;
  lob?: string;
  product?: string;
  codeDescription?: string;
  category?: string;
  codeType?: string;
  rate?: number | string;
  stateName?: string;
  cityName?: string;
  address?: string;
  zip?: string;
  phone?: string;
  website?: string;
  npi?: string | number;
  latitude?: number | string;
  longitude?: number | string;
  hospitalType?: string;
  healthsystemType?: string;
  corporateEntity?: string;
  additionalPayerNotes?: string;
  methodology?: string;
  msaName?: string;
}

export interface HclPagedResponse {
  success?: boolean;
  msg?: string;
  message?: string;
  pageNumber?: number;
  pageSize?: number;
  totalCount?: number;
  hasMore?: boolean;
  ratesList?: HclRawRate[];
}
