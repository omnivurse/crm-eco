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

export { asNumber, asText } from './normalize';

export { summarizeResultSlice } from './result-slice';
export type { SliceTick, ResultSliceSummary } from './result-slice';

export {
  classifyPayer,
  describePayer,
  describePlan,
  payerClassLabel,
  uniquePayers,
} from './payer';
export type { PayerClass } from './payer';

export {
  flagRateOutliers,
  flagHighExtremes,
  partitionRates,
  mergeHidden,
  toggleHiddenId,
  tickIdentity,
  highestRate,
  LOW_CMS_FLOOR,
  HIGH_CMS_CEILING,
  EXTREME_MIN_N,
  EXTREME_MEDIAN_MULT,
} from './outliers';

export {
  discardedStorageKey,
  readDiscardedIds,
  serializeDiscardedIds,
  persistDiscardedIds,
  DISCARDED_STORAGE_PREFIX,
} from './discard';

export { planNegotiation, bidDelta } from './negotiate';
export type { NegotiatePlan } from './negotiate';

export {
  PROCEDURE_FAMILIES,
  searchProcedureFamilies,
  familyForCode,
} from './procedure-families';
export type { ProcedureFamily, CompanionCode } from './procedure-families';

export {
  RADIUS_MILES,
  haversineMiles,
  pointFromRow,
  originFromSlice,
  milesFromOrigin,
  filterByRadius,
  mapsUrl,
  qualityLookupUrl,
  npiUrl,
} from './geo';
export type { GeoPoint, RadiusMiles } from './geo';

export {
  PAYER_MIX_ORDER,
  emptyPayerMix,
  payerMix,
  mixEntries,
  listDiscount,
  medianListDiscount,
  websiteHref,
  describeFacilityLine,
  facilitySpread,
} from './tape-intel';
export type { PayerMix, FacilitySpread } from './tape-intel';

export {
  clipIdentity,
  compileRateBook,
  sanitizeBookName,
  MAX_CLIPS_PER_BOOK,
  MAX_BOOKS_PER_MEMBER,
  DEFAULT_BOOK_NAME,
} from './rate-book';
export type { RateClipSnapshot, RateBookCompile } from './rate-book';
