import type { MsaAllowlistEntry } from './types';

/**
 * Search types Cash Pay is built for. HCL's public inventory tracks
 * Cash Rates, Inpatient, Outpatient, and Drugs (NDC). Their site also
 * staffs pharmacy pricing and RX wholesaler data. Exact `specialty`
 * strings are MSA-key scoped and must match HCL; override via
 * HCL_SPECIALTIES or allowlist rows.
 */
export interface CashPaySpecialty {
  id: string;
  label: string;
  /** Exact string sent as GetRateDataPaged `specialty`. */
  hclName: string;
  codeHint: string;
}

export const CASH_PAY_CATALOG: CashPaySpecialty[] = [
  {
    id: 'hospital',
    label: 'Hospital & facility',
    hclName: 'Hospital cash prices',
    codeHint: 'CPT / HCPCS',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy / RX',
    hclName: 'Pharmacy',
    codeHint: 'NDC',
  },
  {
    id: 'imaging',
    label: 'Imaging',
    hclName: 'Imaging',
    codeHint: 'CPT',
  },
  {
    id: 'laboratory',
    label: 'Laboratory',
    hclName: 'Laboratory',
    codeHint: 'CPT',
  },
];

export function parseSpecialtyCatalog(raw: string | undefined | null): CashPaySpecialty[] {
  if (!raw || !raw.trim()) return [...CASH_PAY_CATALOG];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...CASH_PAY_CATALOG];
    const out: CashPaySpecialty[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const hclName = typeof r.hclName === 'string' ? r.hclName.trim() : '';
      const label = typeof r.label === 'string' ? r.label.trim() : hclName;
      if (!hclName || !label) continue;
      const id =
        typeof r.id === 'string' && r.id.trim()
          ? r.id.trim()
          : hclName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const codeHint =
        typeof r.codeHint === 'string' && r.codeHint.trim()
          ? r.codeHint.trim()
          : /pharm|rx|ndc|drug/i.test(`${label} ${hclName}`)
            ? 'NDC'
            : 'CPT / HCPCS';
      out.push({ id, label, hclName, codeHint });
    }
    return out.length > 0 ? out : [...CASH_PAY_CATALOG];
  } catch {
    return [...CASH_PAY_CATALOG];
  }
}

export function loadSpecialtyCatalogFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CashPaySpecialty[] {
  return parseSpecialtyCatalog(env.HCL_SPECIALTIES);
}

export function uniqueMsas(allowlist: MsaAllowlistEntry[]): MsaAllowlistEntry[] {
  const seen = new Set<string>();
  const out: MsaAllowlistEntry[] = [];
  for (const e of allowlist) {
    const key = `${e.stateName.trim().toLowerCase()}|${e.msaName.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ stateName: e.stateName, msaName: e.msaName });
  }
  return out;
}

export function specialtiesForSearch(
  catalog: CashPaySpecialty[],
  allowlist: MsaAllowlistEntry[],
): CashPaySpecialty[] {
  const byHcl = new Map<string, CashPaySpecialty>();
  for (const item of catalog) {
    byHcl.set(item.hclName.trim().toLowerCase(), item);
  }
  for (const e of allowlist) {
    const name = e.specialty?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (byHcl.has(key)) continue;
    byHcl.set(key, {
      id: key.replace(/[^a-z0-9]+/g, '-'),
      label: name,
      hclName: name,
      codeHint: /pharm|rx|ndc|drug/i.test(name) ? 'NDC' : 'CPT / HCPCS',
    });
  }
  return [...byHcl.values()];
}

export function resolveSpecialty(
  entry: MsaAllowlistEntry | null | undefined,
  requested?: string | null,
): string {
  const asked = requested?.trim();
  if (asked) return asked;
  return entry?.specialty?.trim() || catalogDefaultHclName();
}

export function catalogDefaultHclName(): string {
  return CASH_PAY_CATALOG[0].hclName;
}
