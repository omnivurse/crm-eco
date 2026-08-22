export interface MsaOption {
  stateName: string;
  msaName: string;
  specialty?: string;
}

export interface SpecialtyOption {
  id: string;
  label: string;
  hclName: string;
  codeHint: string;
}

export interface HclRate {
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
  cmsRelativity: number | null;
}

export interface SliceSummary {
  sliceCount: number;
  low: number | null;
  median: number | null;
  high: number | null;
  cmsMin: number | null;
  cmsMax: number | null;
  fileSize: number;
  scope: 'slice';
}
