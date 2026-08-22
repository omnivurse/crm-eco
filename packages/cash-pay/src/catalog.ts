import type { MsaAllowlistEntry } from './types';
import rawCatalog from './hcl-msa-catalog.json';
import { parseMsaAllowlist } from './msa';

function asEntry(row: {
  stateName?: string;
  msaName?: string;
  specialty?: string;
}): MsaAllowlistEntry | null {
  const stateName = typeof row.stateName === 'string' ? row.stateName.trim() : '';
  const msaName = typeof row.msaName === 'string' ? row.msaName.trim() : '';
  if (!stateName || !msaName) return null;
  const entry: MsaAllowlistEntry = { stateName, msaName };
  if (typeof row.specialty === 'string' && row.specialty.trim()) {
    entry.specialty = row.specialty.trim();
  }
  return entry;
}

/** Full HCL inventory pulled from getallstates + getmsabystatename. */
export function loadFullHclCatalog(): MsaAllowlistEntry[] {
  const out: MsaAllowlistEntry[] = [];
  for (const row of rawCatalog as Array<Record<string, unknown>>) {
    const entry = asEntry(row);
    if (entry) out.push(entry);
  }
  return out;
}

export function mergeMsaCatalogs(
  ...lists: MsaAllowlistEntry[][]
): MsaAllowlistEntry[] {
  const map = new Map<string, MsaAllowlistEntry>();
  for (const list of lists) {
    for (const entry of list) {
      const key = `${entry.stateName.trim().toLowerCase()}|${entry.msaName.trim().toLowerCase()}`;
      map.set(key, entry);
    }
  }
  return [...map.values()];
}

/**
 * Default: bundled nationwide catalog + optional env overlay.
 * Set HCL_MSA_ALLOWLIST_ONLY=1 to restrict to the env list (ops / key-scoping).
 */
export function loadMsaAllowlistFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): MsaAllowlistEntry[] {
  const extra = parseMsaAllowlist(env.HCL_MSA_ALLOWLIST);
  const restrict = (env.HCL_MSA_ALLOWLIST_ONLY || '').toLowerCase() === '1';
  if (restrict && extra.length > 0) return extra;
  return mergeMsaCatalogs(loadFullHclCatalog(), extra);
}
