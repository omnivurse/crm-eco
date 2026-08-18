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
  procedureCode: string;
  codeDescription: string;
  category: string;
  rate: number;
  paymentMethod: string | null;
  carrier: string | null;
  planName: string | null;
  lob: string | null;
  product: string | null;
  cmsRelativity: number | null;
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

/** Raw Azure ratesList item (field casing as documented). */
export interface HclRawRate {
  id?: number | string;
  hospitalID?: number;
  hospitalId?: number;
  facilityName?: string;
  planName?: string;
  procedureCode?: string;
  cmsRelativity?: number;
  location?: string;
  paymentMethod?: string;
  carrier?: string;
  lob?: string;
  product?: string;
  codeDescription?: string;
  category?: string;
  rate?: number;
  stateName?: string;
  cityName?: string;
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
