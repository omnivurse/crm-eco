/**
 * Phase 4 — parse ACH return / NOC files. Posting lives in admin.
 * Never invent routing/account. Never treat a missing return as success.
 */

import { digitsOnly, isAbaRoutingNumber, isLast4OnlyAccount } from './nacha';
import type { AchBankDetails } from './ach-vault';
import { AchVaultError, normalizeAchBankDetails } from './ach-vault';
import type { NachaAccountType } from './nacha';

const RECORD_LEN = 94;

export class NachaReturnParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NachaReturnParseError';
    this.code = code;
  }
}

export const ACH_RETURN_REASONS: Record<string, string> = {
  R01: 'Insufficient funds',
  R02: 'Account closed',
  R03: 'No account / unable to locate',
  R04: 'Invalid account number',
  R05: 'Unauthorized debit to consumer',
  R06: 'Returned per ODFI request',
  R07: 'Authorization revoked by customer',
  R08: 'Payment stopped',
  R09: 'Uncollected funds',
  R10: 'Customer advises unauthorized',
  R11: 'Check truncation / authorization error',
  R12: 'Branch sold to another DFI',
  R13: 'Invalid ACH routing number',
  R14: 'Representative payee deceased',
  R15: 'Beneficiary / account holder deceased',
  R16: 'Account frozen',
  R17: 'File record edit criteria',
  R20: 'Non-transaction account',
  R23: 'Credit entry refused by receiver',
  R29: 'Corporate customer advises not authorized',
};

export const ACH_NOC_REASONS: Record<string, string> = {
  C01: 'Incorrect account number',
  C02: 'Incorrect routing number',
  C03: 'Incorrect routing and account number',
  C05: 'Incorrect transaction code',
  C06: 'Incorrect account number and transaction code',
  C07: 'Incorrect routing, account number, and transaction code',
};

export type NachaReturnKind = 'return' | 'noc';

export interface NachaReturnEntry {
  kind: NachaReturnKind;
  originalTrace: string;
  code: string;
  reason: string;
  amountCents: number;
  accountLast4: string | null;
  addendaInfo: string;
  correctedData: string;
}

export interface NachaReturnFile {
  fileDate: string;
  entries: NachaReturnEntry[];
  returnCount: number;
  nocCount: number;
}

function yyMMddToIso(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const mm = value.slice(2, 4);
  const dd = value.slice(4, 6);
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

function splitRecords(contents: string): string[] {
  const lines = contents.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const records: string[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    if (line.length !== RECORD_LEN) {
      throw new NachaReturnParseError(
        'INVALID_RECORD_LENGTH',
        `NACHA return records must be ${RECORD_LEN} characters. Found ${line.length}.`,
      );
    }
    records.push(line);
  }
  if (!records.length) {
    throw new NachaReturnParseError('EMPTY_FILE', 'Return file has no NACHA records.');
  }
  return records;
}

function accountLast4FromEntry(line: string): string | null {
  const account = digitsOnly(line.slice(12, 29));
  return account.length >= 4 ? account.slice(-4) : null;
}

function amountCentsFromEntry(line: string): number {
  const raw = line.slice(29, 39);
  if (!/^\d{10}$/.test(raw)) {
    throw new NachaReturnParseError('INVALID_AMOUNT', 'Entry amount must be 10 digits.');
  }
  return Number(raw);
}

function transactionCodeToAccountType(code: string): NachaAccountType | null {
  if (code === '22' || code === '27' || code === '21' || code === '26') return 'checking';
  if (code === '32' || code === '37' || code === '31' || code === '36') return 'savings';
  return null;
}

export function nocAccountTypeFromCorrectedData(correctedData: string): NachaAccountType {
  const code = digitsOnly((correctedData || '').slice(0, 3)).slice(0, 2);
  const mapped = transactionCodeToAccountType(code);
  if (!mapped) {
    throw new AchVaultError('UNSUPPORTED_NOC', 'NOC transaction code is not a consumer PPD code.');
  }
  return mapped;
}

export function parseNachaReturnFile(contents: string): NachaReturnFile {
  const records = splitRecords(contents);
  let fileDate = '';
  const entries: NachaReturnEntry[] = [];

  for (let i = 0; i < records.length; i += 1) {
    const line = records[i];
    const type = line[0];
    if (type === '1' && !fileDate) {
      fileDate = yyMMddToIso(line.slice(23, 29)) ?? '';
      continue;
    }
    if (type === '5' && !fileDate) {
      fileDate = yyMMddToIso(line.slice(69, 75)) ?? fileDate;
      continue;
    }
    if (type === '5') {
      fileDate = yyMMddToIso(line.slice(69, 75)) ?? fileDate;
      continue;
    }
    if (type !== '6') continue;

    const addenda = records[i + 1];
    if (!addenda || addenda[0] !== '7') {
      throw new NachaReturnParseError(
        'MISSING_ADDENDA',
        'Each return/NOC entry detail must be followed by a type 7 addenda.',
      );
    }
    const addendaType = addenda.slice(1, 3);
    if (addendaType !== '99' && addendaType !== '98') {
      throw new NachaReturnParseError(
        'UNSUPPORTED_ADDENDA',
        `Addenda type ${addendaType} is not a return (99) or NOC (98).`,
      );
    }
    const code = addenda.slice(3, 6).trim().toUpperCase();
    const originalTrace = addenda.slice(6, 21).trim();
    if (!/^\d{15}$/.test(originalTrace)) {
      throw new NachaReturnParseError(
        'INVALID_ORIGINAL_TRACE',
        'Original entry trace number must be 15 digits.',
      );
    }
    if (addendaType === '99') {
      if (!/^R\d{2}$/.test(code)) {
        throw new NachaReturnParseError('INVALID_RETURN_CODE', `Return reason ${code} is not Rnn.`);
      }
      entries.push({
        kind: 'return',
        originalTrace,
        code,
        reason: ACH_RETURN_REASONS[code] ?? `ACH return ${code}`,
        amountCents: amountCentsFromEntry(line),
        accountLast4: accountLast4FromEntry(line),
        addendaInfo: addenda.slice(35, 79).trim(),
        correctedData: '',
      });
    } else {
      if (!/^C\d{2}$/.test(code)) {
        throw new NachaReturnParseError('INVALID_NOC_CODE', `NOC change code ${code} is not Cnn.`);
      }
      if (!ACH_NOC_REASONS[code]) {
        throw new NachaReturnParseError(
          'UNSUPPORTED_NOC_CODE',
          `NOC change code ${code} is not applied. Do not invent a correction.`,
        );
      }
      entries.push({
        kind: 'noc',
        originalTrace,
        code,
        reason: ACH_NOC_REASONS[code],
        amountCents: amountCentsFromEntry(line),
        accountLast4: accountLast4FromEntry(line),
        addendaInfo: addenda.slice(35, 79).trim(),
        correctedData: addenda.slice(35, 64),
      });
    }
    i += 1;
  }

  if (!entries.length) {
    throw new NachaReturnParseError('NO_RETURN_ENTRIES', 'File has no return or NOC entries.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fileDate)) {
    throw new NachaReturnParseError(
      'INVALID_FILE_DATE',
      'Return file is missing a usable file or effective date.',
    );
  }

  return {
    fileDate,
    entries,
    returnCount: entries.filter((entry) => entry.kind === 'return').length,
    nocCount: entries.filter((entry) => entry.kind === 'noc').length,
  };
}

export function applyNocCorrection(
  existing: AchBankDetails,
  changeCode: string,
  correctedData: string,
): AchBankDetails {
  const field = (correctedData || '').padEnd(29, ' ');
  let routingNumber = existing.routingNumber;
  let accountNumber = existing.accountNumber;
  let accountType = existing.accountType;

  const readAccount = (start: number, len = 17) => digitsOnly(field.slice(start, start + len));
  const readRouting = (start = 0) => digitsOnly(field.slice(start, start + 9));
  const readTxn = (start: number) => digitsOnly(field.slice(start, start + 3)).slice(0, 2);

  if (changeCode === 'C01') {
    accountNumber = readAccount(0);
  } else if (changeCode === 'C02') {
    routingNumber = readRouting(0);
  } else if (changeCode === 'C03') {
    routingNumber = readRouting(0);
    accountNumber = readAccount(9);
  } else if (changeCode === 'C05') {
    const mapped = transactionCodeToAccountType(readTxn(0));
    if (!mapped) {
      throw new AchVaultError('UNSUPPORTED_NOC', 'NOC transaction code is not a consumer PPD code.');
    }
    accountType = mapped;
  } else if (changeCode === 'C06') {
    accountNumber = readAccount(0);
    const mapped = transactionCodeToAccountType(readTxn(17));
    if (mapped) accountType = mapped;
  } else if (changeCode === 'C07') {
    routingNumber = readRouting(0);
    accountNumber = readAccount(9);
    const mapped = transactionCodeToAccountType(readTxn(26));
    if (mapped) accountType = mapped;
  } else {
    throw new AchVaultError('UNSUPPORTED_NOC', `NOC ${changeCode} is not applied.`);
  }

  if (!isAbaRoutingNumber(routingNumber)) {
    throw new AchVaultError('INVALID_ROUTING', 'NOC corrected routing is not a valid ABA.');
  }
  if (isLast4OnlyAccount(accountNumber)) {
    throw new AchVaultError('LAST4_ONLY', 'NOC corrected account is last4-only. Do not invent digits.');
  }
  return normalizeAchBankDetails({ routingNumber, accountNumber, accountType });
}
