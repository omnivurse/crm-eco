import type { MsaAllowlistEntry } from './types';

/**
 * ZIP prefix → US state full name (HCL expects full names like "Oregon").
 * Covers common ranges; allowlist is still the source of truth for MSAs.
 */
const ZIP_PREFIX_TO_STATE: Array<{ min: number; max: number; state: string }> = [
  { min: 1000, max: 2799, state: 'Massachusetts' },
  { min: 2800, max: 2999, state: 'Rhode Island' },
  { min: 3000, max: 3899, state: 'New Hampshire' },
  { min: 3900, max: 4999, state: 'Maine' },
  { min: 5000, max: 5999, state: 'Vermont' },
  { min: 6000, max: 6999, state: 'Connecticut' },
  { min: 7000, max: 8999, state: 'New Jersey' },
  { min: 10000, max: 14999, state: 'New York' },
  { min: 15000, max: 19699, state: 'Pennsylvania' },
  { min: 19700, max: 19999, state: 'Delaware' },
  { min: 20000, max: 20599, state: 'District of Columbia' },
  { min: 20600, max: 21999, state: 'Maryland' },
  { min: 22000, max: 24699, state: 'Virginia' },
  { min: 24700, max: 26999, state: 'West Virginia' },
  { min: 27000, max: 28999, state: 'North Carolina' },
  { min: 29000, max: 29999, state: 'South Carolina' },
  { min: 30000, max: 31999, state: 'Georgia' },
  { min: 32000, max: 34999, state: 'Florida' },
  { min: 35000, max: 36999, state: 'Alabama' },
  { min: 37000, max: 38599, state: 'Tennessee' },
  { min: 38600, max: 39799, state: 'Mississippi' },
  { min: 40000, max: 42799, state: 'Kentucky' },
  { min: 43000, max: 45999, state: 'Ohio' },
  { min: 46000, max: 47999, state: 'Indiana' },
  { min: 48000, max: 49999, state: 'Michigan' },
  { min: 50000, max: 52899, state: 'Iowa' },
  { min: 53000, max: 54999, state: 'Wisconsin' },
  { min: 55000, max: 56799, state: 'Minnesota' },
  { min: 57000, max: 57799, state: 'South Dakota' },
  { min: 58000, max: 58899, state: 'North Dakota' },
  { min: 59000, max: 59999, state: 'Montana' },
  { min: 60000, max: 62999, state: 'Illinois' },
  { min: 63000, max: 65899, state: 'Missouri' },
  { min: 66000, max: 67999, state: 'Kansas' },
  { min: 68000, max: 69399, state: 'Nebraska' },
  { min: 70000, max: 71499, state: 'Louisiana' },
  { min: 71600, max: 72999, state: 'Arkansas' },
  { min: 73000, max: 74999, state: 'Oklahoma' },
  { min: 75000, max: 79999, state: 'Texas' },
  { min: 80000, max: 81699, state: 'Colorado' },
  { min: 82000, max: 83199, state: 'Wyoming' },
  { min: 83200, max: 83899, state: 'Idaho' },
  { min: 84000, max: 84799, state: 'Utah' },
  { min: 85000, max: 86599, state: 'Arizona' },
  { min: 87000, max: 88499, state: 'New Mexico' },
  { min: 88900, max: 89899, state: 'Nevada' },
  { min: 90000, max: 96199, state: 'California' },
  { min: 96700, max: 96899, state: 'Hawaii' },
  { min: 97000, max: 97999, state: 'Oregon' },
  { min: 98000, max: 99499, state: 'Washington' },
  { min: 99500, max: 99999, state: 'Alaska' },
];

const STATE_ABBREV: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export function normalizeStateName(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (STATE_ABBREV[upper]) return STATE_ABBREV[upper];
  // Title-case full name if already looks like one
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/\bOf\b/, 'of');
}

export function stateFromZip(zip: string): string | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const n = Number(zip);
  for (const row of ZIP_PREFIX_TO_STATE) {
    if (n >= row.min && n <= row.max) return row.state;
  }
  return null;
}

export function parseMsaAllowlist(raw: string | undefined | null): MsaAllowlistEntry[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: MsaAllowlistEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const stateName = typeof r.stateName === 'string' ? r.stateName.trim() : '';
      const msaName = typeof r.msaName === 'string' ? r.msaName.trim() : '';
      if (!stateName || !msaName) continue;
      const entry: MsaAllowlistEntry = { stateName, msaName };
      if (typeof r.specialty === 'string' && r.specialty.trim()) {
        entry.specialty = r.specialty.trim();
      }
      out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

export function loadMsaAllowlistFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): MsaAllowlistEntry[] {
  return parseMsaAllowlist(env.HCL_MSA_ALLOWLIST);
}

export function msasForState(
  allowlist: MsaAllowlistEntry[],
  stateName: string,
): MsaAllowlistEntry[] {
  const target = stateName.trim().toLowerCase();
  return allowlist.filter((e) => e.stateName.trim().toLowerCase() === target);
}

export function uniqueStates(allowlist: MsaAllowlistEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of allowlist) {
    const key = e.stateName.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e.stateName);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
