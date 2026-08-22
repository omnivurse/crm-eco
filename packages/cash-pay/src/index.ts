export type {
  CashPayErrorCode,
  MsaAllowlistEntry,
  CashRateRow,
  GetRateDataPagedInput,
  GetRateDataPagedSuccess,
  GetRateDataPagedFailure,
  GetRateDataPagedResult,
} from './types';

export {
  normalizeRate,
  mapHclError,
  parseHclPagedBody,
  userMessageForCode,
  defaultSpecialty,
} from './normalize';

export {
  normalizeStateName,
  stateFromZip,
  parseMsaAllowlist,
  msasForState,
  uniqueStates,
  pickPreferredState,
  hclStateForZip,
  preferredMsaForZip,
} from './msa';

export {
  loadFullHclCatalog,
  mergeMsaCatalogs,
  loadHclCatalog,
  loadMsaAllowlistFromEnv,
} from './catalog';

export {
  CASH_PAY_CATALOG,
  parseSpecialtyCatalog,
  loadSpecialtyCatalogFromEnv,
  uniqueMsas,
  specialtiesForSearch,
  resolveSpecialty,
  catalogDefaultHclName,
} from './specialties';
export type { CashPaySpecialty } from './specialties';

export { getRateDataPaged } from './client';
export type { HclClientConfig } from './client';

export { buildCacheKey, getCached, setCached, clearCache } from './cache';

export {
  resolveRateQuery,
  resolvePreferredMarket,
  resolveLiveSpecialty,
} from './rate-query';
export type {
  RateQueryInput,
  RateQueryResult,
  RateQuerySuccess,
  RateQueryFailure,
  PreferredMarket,
} from './rate-query';

export { summarizeResultSlice } from './result-slice';
export type { SliceTick, ResultSliceSummary } from './result-slice';
