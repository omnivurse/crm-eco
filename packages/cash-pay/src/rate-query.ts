import type { CashPayErrorCode, MsaAllowlistEntry } from './types';
import { loadHclCatalog } from './catalog';
import {
  hclStateForZip,
  msasForState,
  normalizeStateName,
  pickPreferredState,
  preferredMsaForZip,
} from './msa';
import {
  catalogDefaultHclName,
  loadSpecialtyCatalogFromEnv,
  specialtiesForSearch,
  type CashPaySpecialty,
} from './specialties';
import { userMessageForCode } from './normalize';

export interface RateQueryInput {
  zip?: string | null;
  state?: string | null;
  msa?: string | null;
  specialty?: string | null;
  allowlist?: MsaAllowlistEntry[];
  specialties?: CashPaySpecialty[];
}

export interface RateQuerySuccess {
  ok: true;
  stateName: string;
  msaName: string;
  specialty: string;
  entry: MsaAllowlistEntry;
}

export interface RateQueryFailure {
  ok: false;
  code: Extract<CashPayErrorCode, 'invalid_input' | 'no_msa_mapping' | 'empty'>;
  message: string;
}

export type RateQueryResult = RateQuerySuccess | RateQueryFailure;

export interface PreferredMarket {
  stateName: string | null;
  msaName: string | null;
  zip: string;
}

function catalog(input: RateQueryInput): MsaAllowlistEntry[] {
  return input.allowlist ?? loadHclCatalog();
}

function liveSpecialties(
  input: RateQueryInput,
  allowlist: MsaAllowlistEntry[],
): CashPaySpecialty[] {
  return input.specialties ?? specialtiesForSearch(loadSpecialtyCatalogFromEnv(), allowlist);
}

function invalidZip(zip: string | null | undefined): boolean {
  return Boolean(zip && zip.trim() && !/^\d{5}$/.test(zip.trim()));
}

/**
 * Pick a live specialty. Requested names that the key cannot fulfill
 * (Pharmacy / Imaging / Laboratory on this key) fall back to hospital.
 */
export function resolveLiveSpecialty(
  live: CashPaySpecialty[],
  entry: MsaAllowlistEntry | null | undefined,
  requested?: string | null,
): string {
  const asked = requested?.trim();
  if (asked) {
    const match = live.find((s) => s.hclName.trim().toLowerCase() === asked.toLowerCase());
    if (match) return match.hclName;
  }
  const fromEntry = entry?.specialty?.trim();
  if (fromEntry) {
    const match = live.find((s) => s.hclName.trim().toLowerCase() === fromEntry.toLowerCase());
    if (match) return match.hclName;
  }
  return live[0]?.hclName || catalogDefaultHclName();
}

/** Dropdown default: first catalog-legal HCL Market from ZIP / state / extras. */
export function resolvePreferredMarket(
  input: Pick<RateQueryInput, 'zip' | 'state' | 'allowlist'> & {
    extraCandidates?: Array<string | null | undefined>;
  },
): PreferredMarket {
  const allowlist = catalog(input);
  const zip = input.zip?.trim() || '';
  const inferred = zip && /^\d{5}$/.test(zip) ? hclStateForZip(zip) : null;
  const metroHint = zip && /^\d{5}$/.test(zip) ? preferredMsaForZip(zip) : null;
  const requested = normalizeStateName(input.state || undefined);
  const stateName = pickPreferredState(allowlist, [
    requested,
    inferred,
    metroHint?.stateName,
    ...(input.extraCandidates || []),
  ]);
  let msaName: string | null = null;
  if (stateName && metroHint) {
    const hit = msasForState(allowlist, stateName).find(
      (e) => e.msaName.trim().toLowerCase() === metroHint.msaName.toLowerCase(),
    );
    if (hit) msaName = hit.msaName;
  }
  return { stateName, msaName, zip };
}

/**
 * Catalog-legal query for GetRateDataPaged.
 * Invariant: a success result is safe to send upstream.
 */
export function resolveRateQuery(input: RateQueryInput): RateQueryResult {
  const zip = input.zip?.trim() || '';
  if (invalidZip(zip)) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Valid 5-digit ZIP code required',
    };
  }

  const allowlist = catalog(input);
  if (allowlist.length === 0) {
    return {
      ok: false,
      code: 'empty',
      message: userMessageForCode('empty'),
    };
  }

  const requestedState = normalizeStateName(input.state || undefined);
  const inferred = zip ? hclStateForZip(zip) : null;
  const stateName = requestedState || inferred;
  const msaName = input.msa?.trim() || '';

  if (!stateName || !msaName) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'State / region and nearest region are required.',
    };
  }

  const entry = msasForState(allowlist, stateName).find(
    (e) => e.msaName.trim().toLowerCase() === msaName.toLowerCase(),
  );
  if (!entry) {
    return {
      ok: false,
      code: 'no_msa_mapping',
      message: 'This metro area is not in the published file yet.',
    };
  }

  const live = liveSpecialties(input, allowlist);
  return {
    ok: true,
    stateName: entry.stateName,
    msaName: entry.msaName,
    specialty: resolveLiveSpecialty(live, entry, input.specialty),
    entry,
  };
}
