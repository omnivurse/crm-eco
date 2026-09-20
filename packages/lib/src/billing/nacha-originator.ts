export const ACH_ORIGINATOR_SETTING_KEY = 'ach_originator';
export const ACH_SEC_CODE = 'PPD';
export const DEFAULT_NACHA_FILE_NAME_PATTERN = 'NACHA_yyyyMMdd_HHmmss.txt';

export type AchSettlementAccountType = 'checking' | 'savings';

export interface AchOriginatorConfig {
  destinationRouting: string;
  destinationName: string;
  companyName: string;
  companyId: string;
  odfiId: string;
  secCode: typeof ACH_SEC_CODE;
  fileNamePattern: string;
  settlementRouting: string;
  settlementAccount: string;
  settlementAccountType: AchSettlementAccountType;
}

export interface AchOriginatorPublic {
  destinationRouting: string;
  destinationName: string;
  companyName: string;
  companyId: string;
  odfiId: string;
  secCode: typeof ACH_SEC_CODE;
  fileNamePattern: string;
  settlementRouting: string;
  settlementAccountMasked: string;
  settlementAccountLast4: string;
  settlementAccountType: AchSettlementAccountType;
  complete: true;
}

export class NachaConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      missing.length
        ? `ACH originator settings are incomplete: ${missing.join(', ')}`
        : 'ACH originator settings are incomplete',
    );
    this.name = 'NachaConfigError';
    this.missing = missing;
  }
}

const DIGITS = /^\d+$/;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function isAbaRoutingNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const sum =
    3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + 1 * (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

export function maskAccountNumber(account: string): string {
  const digits = digitsOnly(account);
  if (digits.length < 4) return '****';
  return `****${digits.slice(-4)}`;
}

export function isMaskedAccountNumber(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return trimmed.includes('*');
}

function field(
  missing: string[],
  key: string,
  raw: unknown,
  opts: { max?: number; min?: number; exact?: number; digits?: boolean; aba?: boolean },
): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    missing.push(key);
    return '';
  }
  if (opts.digits && !DIGITS.test(value)) {
    missing.push(`${key} (digits only)`);
    return value;
  }
  if (opts.exact != null && value.length !== opts.exact) {
    missing.push(`${key} (${opts.exact} characters)`);
    return value;
  }
  if (opts.min != null && value.length < opts.min) {
    missing.push(`${key} (at least ${opts.min} characters)`);
    return value;
  }
  if (opts.max != null && value.length > opts.max) {
    missing.push(`${key} (at most ${opts.max} characters)`);
    return value;
  }
  if (opts.aba && !isAbaRoutingNumber(value)) {
    missing.push(`${key} (invalid ABA routing number)`);
    return value;
  }
  return value;
}

export function parseAchOriginator(value: unknown): AchOriginatorConfig {
  let source: Record<string, unknown> = {};
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        source = parsed as Record<string, unknown>;
      }
    } catch {
      throw new NachaConfigError(['ach_originator (invalid JSON)']);
    }
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    source = value as Record<string, unknown>;
  }

  const missing: string[] = [];
  const destinationRouting = field(missing, 'destinationRouting', source.destinationRouting, {
    digits: true,
    exact: 9,
    aba: true,
  });
  const destinationName = field(missing, 'destinationName', source.destinationName, { max: 23, min: 1 });
  const companyName = field(missing, 'companyName', source.companyName, { max: 16, min: 1 });
  const companyId = field(missing, 'companyId', source.companyId, { digits: true, exact: 10 });
  const odfiId = field(missing, 'odfiId', source.odfiId, { digits: true, exact: 8 });
  const fileNamePattern = field(missing, 'fileNamePattern', source.fileNamePattern ?? DEFAULT_NACHA_FILE_NAME_PATTERN, {
    min: 1,
    max: 80,
  });
  const settlementRouting = field(missing, 'settlementRouting', source.settlementRouting, {
    digits: true,
    exact: 9,
    aba: true,
  });
  const settlementAccount = field(missing, 'settlementAccount', source.settlementAccount, {
    digits: true,
    min: 5,
    max: 17,
  });

  const settlementAccountTypeRaw =
    typeof source.settlementAccountType === 'string' ? source.settlementAccountType.trim() : '';
  if (settlementAccountTypeRaw !== 'checking' && settlementAccountTypeRaw !== 'savings') {
    missing.push('settlementAccountType (checking or savings)');
  }

  const secRaw = typeof source.secCode === 'string' ? source.secCode.trim().toUpperCase() : ACH_SEC_CODE;
  if (secRaw !== ACH_SEC_CODE) {
    missing.push('secCode (must be PPD)');
  }

  if (fileNamePattern && !fileNamePattern.includes('yyyyMMdd')) {
    missing.push('fileNamePattern (must include yyyyMMdd)');
  }

  if (destinationRouting && odfiId && odfiId !== destinationRouting.slice(0, 8)) {
    missing.push('odfiId (must match first 8 digits of destinationRouting)');
  }

  if (missing.length) {
    throw new NachaConfigError(missing);
  }

  return {
    destinationRouting,
    destinationName,
    companyName,
    companyId,
    odfiId,
    secCode: ACH_SEC_CODE,
    fileNamePattern,
    settlementRouting,
    settlementAccount,
    settlementAccountType: settlementAccountTypeRaw as AchSettlementAccountType,
  };
}

export function toPublicAchOriginator(config: AchOriginatorConfig): AchOriginatorPublic {
  return {
    destinationRouting: config.destinationRouting,
    destinationName: config.destinationName,
    companyName: config.companyName,
    companyId: config.companyId,
    odfiId: config.odfiId,
    secCode: config.secCode,
    fileNamePattern: config.fileNamePattern,
    settlementRouting: config.settlementRouting,
    settlementAccountMasked: maskAccountNumber(config.settlementAccount),
    settlementAccountLast4: digitsOnly(config.settlementAccount).slice(-4),
    settlementAccountType: config.settlementAccountType,
    complete: true,
  };
}

const DRAFT_KEYS = [
  'destinationRouting',
  'destinationName',
  'companyName',
  'companyId',
  'odfiId',
  'secCode',
  'fileNamePattern',
  'settlementRouting',
  'settlementAccountType',
] as const;

export function readAchOriginatorDraft(value: unknown): Record<string, string> {
  let source: Record<string, unknown> = {};
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        source = parsed as Record<string, unknown>;
      }
    } catch {
      source = {};
    }
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    source = value as Record<string, unknown>;
  }

  const draft: Record<string, string> = {
    fileNamePattern: DEFAULT_NACHA_FILE_NAME_PATTERN,
    secCode: ACH_SEC_CODE,
    settlementAccountType: 'checking',
  };
  for (const key of DRAFT_KEYS) {
    const raw = source[key];
    if (typeof raw === 'string' && raw.trim()) {
      draft[key] = raw.trim();
    }
  }
  const settlementAccount =
    typeof source.settlementAccount === 'string' ? source.settlementAccount : '';
  if (digitsOnly(settlementAccount).length >= 4) {
    draft.settlementAccountMasked = maskAccountNumber(settlementAccount);
  }
  return draft;
}

export function missingAchOriginatorFields(value: unknown): string[] {
  try {
    parseAchOriginator(value);
    return [];
  } catch (error) {
    if (error instanceof NachaConfigError) return error.missing;
    return ['ach_originator'];
  }
}

export function mergeAchOriginatorInput(
  incoming: Record<string, unknown>,
  existing: AchOriginatorConfig | null,
): unknown {
  const settlementAccount =
    typeof incoming.settlementAccount === 'string' ? incoming.settlementAccount : '';
  if (existing && isMaskedAccountNumber(settlementAccount)) {
    return { ...incoming, settlementAccount: existing.settlementAccount };
  }
  return incoming;
}
