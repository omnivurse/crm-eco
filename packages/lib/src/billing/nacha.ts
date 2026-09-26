import {
  digitsOnly,
  isAbaRoutingNumber,
  type AchOriginatorConfig,
  type AchSettlementAccountType,
} from './nacha-originator';

export {
  ACH_ORIGINATOR_SETTING_KEY,
  ACH_SEC_CODE,
  DEFAULT_NACHA_FILE_NAME_PATTERN,
  NachaConfigError,
  digitsOnly,
  isAbaRoutingNumber,
  isMaskedAccountNumber,
  maskAccountNumber,
  mergeAchOriginatorInput,
  missingAchOriginatorFields,
  parseAchOriginator,
  readAchOriginatorDraft,
  toPublicAchOriginator,
} from './nacha-originator';
export type {
  AchOriginatorConfig,
  AchOriginatorPublic,
  AchSettlementAccountType,
} from './nacha-originator';

export type NachaEntryType = 'charge' | 'refund';
export type NachaAccountType = AchSettlementAccountType;

/** File-level settlement offset. Not a billing_transactions row. */
export const NACHA_BALANCING_ENTRY_ID = '__nacha_balancing__';

export interface NachaBalancingTrace {
  nachaFileId?: string;
  traceNumber: string;
  amountCents: number;
  accountLast4: string | null;
  transactionCode?: string | null;
}

/** Read the settlement-offset trace stored on an export's processing_notes. */
export function readBalancingTraceFromNotes(
  notes: unknown,
  nachaFileId?: string,
): NachaBalancingTrace | null {
  if (!notes || typeof notes !== 'object') return null;
  const entry = (notes as { balancingEntry?: Record<string, unknown> }).balancingEntry;
  if (!entry || typeof entry !== 'object') return null;
  const traceNumber = typeof entry.traceNumber === 'string' ? entry.traceNumber.trim() : '';
  if (!/^\d{15}$/.test(traceNumber)) return null;
  const amountCents = Number(entry.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) return null;
  const last4 = typeof entry.accountLast4 === 'string' ? digitsOnly(entry.accountLast4).slice(-4) : '';
  return {
    nachaFileId,
    traceNumber,
    amountCents,
    accountLast4: last4.length === 4 ? last4 : null,
    transactionCode: typeof entry.transactionCode === 'string' ? entry.transactionCode : null,
  };
}

export function matchSettlementOffsetReturn(
  traces: NachaBalancingTrace[],
  originalTrace: string,
  amountCents: number,
  accountLast4?: string | null,
): NachaBalancingTrace | null {
  const last4 = accountLast4 ? digitsOnly(accountLast4).slice(-4) : '';
  return (
    traces.find((trace) => {
      if (trace.traceNumber !== originalTrace) return false;
      if (trace.amountCents !== amountCents) return false;
      if (trace.accountLast4 && last4 && trace.accountLast4 !== last4) return false;
      return true;
    }) ?? null
  );
}

export interface NachaEntryInput {
  transactionId: string;
  transactionType: NachaEntryType;
  amountCents: number;
  routingNumber: string;
  accountNumber: string;
  accountType: NachaAccountType;
  individualName: string;
  individualId: string;
  accountLast4?: string | null;
}

export interface GenerateNachaInput {
  originator: AchOriginatorConfig;
  entries: NachaEntryInput[];
  effectiveDate: string;
  createdAt?: Date;
  fileIdModifier: string;
}

export interface NachaTrace {
  transactionId: string;
  traceNumber: string;
  transactionCode: string;
  amountCents: number;
  accountLast4: string;
}

export interface NachaFileResult {
  fileName: string;
  contents: string;
  lines: string[];
  debitCents: number;
  creditCents: number;
  entryHash: number;
  serviceClassCode: string;
  traces: NachaTrace[];
}

export class NachaGenerateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NachaGenerateError';
  }
}

const RECORD_LEN = 94;
const FILE_ID_MODIFIERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function nextFileIdModifier(existingCountToday: number): string {
  if (!Number.isInteger(existingCountToday) || existingCountToday < 0) {
    throw new NachaGenerateError('File ID modifier count must be a non-negative integer');
  }
  if (existingCountToday >= FILE_ID_MODIFIERS.length) {
    throw new NachaGenerateError('Maximum of 26 NACHA files per day (A–Z) reached');
  }
  return FILE_ID_MODIFIERS[existingCountToday];
}

export function nachaTransactionCode(
  transactionType: NachaEntryType,
  accountType: NachaAccountType,
): string {
  if (transactionType === 'charge') {
    return accountType === 'savings' ? '37' : '27';
  }
  return accountType === 'savings' ? '32' : '22';
}

/**
 * NACHA Service Class Codes describe the entries in a batch:
 * 200 = mixed debits/credits, 220 = credits only, 225 = debits only.
 */
export function nachaServiceClassCode(hasDebit: boolean, hasCredit: boolean): string {
  if (hasDebit && hasCredit) return '200';
  if (hasCredit) return '220';
  if (hasDebit) return '225';
  throw new NachaGenerateError('A NACHA batch must contain at least one debit or credit');
}

/** Live payment_profiles store last4 on last_four and sometimes account_last4. */
export function coalesceAccountLast4(
  accountLast4?: string | null,
  lastFour?: string | null,
): string | null {
  const digits = digitsOnly(accountLast4 || lastFour || '');
  if (!digits) return null;
  return digits.slice(-4);
}

export function isLast4OnlyAccount(accountNumber: string, accountLast4?: string | null): boolean {
  const digits = digitsOnly(accountNumber);
  if (digits.length <= 4) return true;
  if (/^0+\d{1,4}$/.test(digits)) return true;
  const last4 = accountLast4 ? digitsOnly(accountLast4) : '';
  if (last4.length === 4 && digits === last4) return true;
  return false;
}

function padRight(value: string, len: number): string {
  if (value.length > len) {
    throw new NachaGenerateError(`Value exceeds ${len} characters`);
  }
  return value.padEnd(len, ' ');
}

function padLeftZeros(value: string | number, len: number): string {
  const text = String(value);
  if (text.length > len) {
    throw new NachaGenerateError(`Numeric field exceeds ${len} digits`);
  }
  return text.padStart(len, '0');
}

function record(chunks: string[]): string {
  const line = chunks.join('');
  if (line.length !== RECORD_LEN) {
    throw new NachaGenerateError(`NACHA record length ${line.length}, expected ${RECORD_LEN}`);
  }
  return line;
}

function utcStamp(date: Date): { fileDate: string; fileTime: string; fileDateLong: string; fileTimeLong: string } {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return {
    fileDate: `${yyyy.slice(2)}${mm}${dd}`,
    fileTime: `${hh}${mi}`,
    fileDateLong: `${yyyy}${mm}${dd}`,
    fileTimeLong: `${hh}${mi}${ss}`,
  };
}

function parseEffectiveDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new NachaGenerateError('effectiveDate must be YYYY-MM-DD');
  }
  return `${match[1].slice(2)}${match[2]}${match[3]}`;
}

export function formatNachaFileName(pattern: string, createdAt: Date): string {
  const stamp = utcStamp(createdAt);
  return pattern
    .split('yyyyMMdd').join(stamp.fileDateLong)
    .split('HHmmss').join(stamp.fileTimeLong)
    .split('yyMMdd').join(stamp.fileDate)
    .split('HHmm').join(stamp.fileTime);
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

function entryHashFromRoutings(routings: string[]): number {
  const sum = routings.reduce((acc, routing) => acc + parseInt(routing.slice(0, 8), 10), 0);
  return sum % 10_000_000_000;
}

export function generateNachaFile(input: GenerateNachaInput): NachaFileResult {
  const { originator, entries } = input;
  if (!entries.length) {
    throw new NachaGenerateError('At least one ACH entry is required');
  }
  if (!/^[A-Z]$/.test(input.fileIdModifier)) {
    throw new NachaGenerateError('fileIdModifier must be A–Z');
  }

  const createdAt = input.createdAt ?? new Date();
  const stamp = utcStamp(createdAt);
  const effDate = parseEffectiveDate(input.effectiveDate);
  const batchNumber = '0000001';

  let debitCents = 0;
  let creditCents = 0;
  const routings: string[] = [];
  const traces: NachaTrace[] = [];
  const entryLines: string[] = [];

  entries.forEach((entry, index) => {
    if (entry.transactionType !== 'charge' && entry.transactionType !== 'refund') {
      throw new NachaGenerateError(`Unsupported transaction type: ${entry.transactionType}`);
    }
    if (entry.accountType !== 'checking' && entry.accountType !== 'savings') {
      throw new NachaGenerateError('accountType must be checking or savings (PPD consumer only)');
    }
    if (!Number.isInteger(entry.amountCents) || entry.amountCents <= 0 || entry.amountCents > 9_999_999_999) {
      throw new NachaGenerateError('amountCents must be a positive integer');
    }

    const routing = digitsOnly(entry.routingNumber);
    if (!/^\d{9}$/.test(routing)) {
      throw new NachaGenerateError(`Entry ${entry.transactionId} is missing a 9-digit routing number`);
    }
    const account = digitsOnly(entry.accountNumber);
    if (isLast4OnlyAccount(account, entry.accountLast4)) {
      throw new NachaGenerateError(`Entry ${entry.transactionId} has last4-only account data`);
    }
    if (account.length < 5 || account.length > 17) {
      throw new NachaGenerateError(`Entry ${entry.transactionId} account number length is invalid`);
    }

    const code = nachaTransactionCode(entry.transactionType, entry.accountType);
    if (entry.transactionType === 'charge') {
      debitCents += entry.amountCents;
    } else {
      creditCents += entry.amountCents;
    }

    routings.push(routing);
    const sequence = padLeftZeros(index + 1, 7);
    const traceNumber = `${originator.odfiId}${sequence}`;
    const last4 = account.slice(-4);
    traces.push({
      transactionId: entry.transactionId,
      traceNumber,
      transactionCode: code,
      amountCents: entry.amountCents,
      accountLast4: last4,
    });

    const individualId = entry.individualId.replace(/[^A-Za-z0-9]/g, '').slice(0, 15);
    const individualName = normalizeName(entry.individualName).slice(0, 22);

    entryLines.push(
      record([
        '6',
        code,
        routing.slice(0, 8),
        routing.slice(8, 9),
        padRight(account, 17),
        padLeftZeros(entry.amountCents, 10),
        padRight(individualId, 15),
        padRight(individualName, 22),
        '  ',
        '0',
        traceNumber,
      ]),
    );
  });

  const netCents = debitCents - creditCents;
  if (netCents !== 0) {
    const settlementRouting = digitsOnly(originator.settlementRouting);
    const settlementAccount = digitsOnly(originator.settlementAccount);
    if (!isAbaRoutingNumber(settlementRouting)) {
      throw new NachaGenerateError('Settlement routing must be a valid 9-digit ABA to balance the file');
    }
    if (isLast4OnlyAccount(settlementAccount) || settlementAccount.length < 5 || settlementAccount.length > 17) {
      throw new NachaGenerateError(
        'Settlement account is last4-only or invalid. Do not invent the offset account.',
      );
    }
    const offsetType: NachaEntryType = netCents > 0 ? 'refund' : 'charge';
    const offsetCents = Math.abs(netCents);
    const offsetCode = nachaTransactionCode(offsetType, originator.settlementAccountType);
    if (offsetType === 'charge') debitCents += offsetCents;
    else creditCents += offsetCents;
    routings.push(settlementRouting);
    const sequence = padLeftZeros(entryLines.length + 1, 7);
    const traceNumber = `${originator.odfiId}${sequence}`;
    traces.push({
      transactionId: NACHA_BALANCING_ENTRY_ID,
      traceNumber,
      transactionCode: offsetCode,
      amountCents: offsetCents,
      accountLast4: settlementAccount.slice(-4),
    });
    entryLines.push(
      record([
        '6',
        offsetCode,
        settlementRouting.slice(0, 8),
        settlementRouting.slice(8, 9),
        padRight(settlementAccount, 17),
        padLeftZeros(offsetCents, 10),
        padRight(originator.companyId.replace(/[^A-Za-z0-9]/g, '').slice(0, 15), 15),
        padRight(normalizeName(originator.companyName).slice(0, 22), 22),
        '  ',
        '0',
        traceNumber,
      ]),
    );
  }

  if (debitCents !== creditCents) {
    throw new NachaGenerateError('NACHA file debit and credit totals must match after the settlement offset');
  }

  const hasDebit = debitCents > 0;
  const hasCredit = creditCents > 0;
  const serviceClassCode = nachaServiceClassCode(hasDebit, hasCredit);
  const entryHash = entryHashFromRoutings(routings);
  const entryDescription = hasDebit && !hasCredit ? 'PAYMENT' : !hasDebit && hasCredit ? 'REFUND' : 'PAYMENT';

  const header = record([
    '1',
    '01',
    ` ${originator.destinationRouting}`,
    originator.companyId,
    stamp.fileDate,
    stamp.fileTime,
    input.fileIdModifier,
    '094',
    '10',
    '1',
    padRight(normalizeName(originator.destinationName), 23),
    padRight(normalizeName(originator.companyName), 23),
    '        ',
  ]);

  const batchHeader = record([
    '5',
    serviceClassCode,
    padRight(normalizeName(originator.companyName), 16),
    padRight('', 20),
    originator.companyId,
    originator.secCode,
    padRight(entryDescription, 10),
    stamp.fileDate,
    effDate,
    '   ',
    '1',
    originator.odfiId,
    batchNumber,
  ]);

  const batchControl = record([
    '8',
    serviceClassCode,
    padLeftZeros(entryLines.length, 6),
    padLeftZeros(entryHash, 10),
    padLeftZeros(debitCents, 12),
    padLeftZeros(creditCents, 12),
    originator.companyId,
    padRight('', 19),
    '      ',
    originator.odfiId,
    batchNumber,
  ]);

  const body = [header, batchHeader, ...entryLines, batchControl];
  const fileControlPlaceholderCount = 1;
  const blockCount = Math.ceil((body.length + fileControlPlaceholderCount) / 10);

  const fileControl = record([
    '9',
    '000001',
    padLeftZeros(blockCount, 6),
    padLeftZeros(entryLines.length, 8),
    padLeftZeros(entryHash, 10),
    padLeftZeros(debitCents, 12),
    padLeftZeros(creditCents, 12),
    padRight('', 39),
  ]);

  const lines = [...body, fileControl];
  while (lines.length % 10 !== 0) {
    lines.push('9'.repeat(RECORD_LEN));
  }

  return {
    fileName: formatNachaFileName(originator.fileNamePattern, createdAt),
    contents: `${lines.join('\r\n')}\r\n`,
    lines,
    debitCents,
    creditCents,
    entryHash,
    serviceClassCode,
    traces,
  };
}
