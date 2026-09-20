import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NACHA_FILE_NAME_PATTERN,
  NACHA_BALANCING_ENTRY_ID,
  NachaConfigError,
  NachaGenerateError,
  generateNachaFile,
  coalesceAccountLast4,
  isLast4OnlyAccount,
  maskAccountNumber,
  mergeAchOriginatorInput,
  missingAchOriginatorFields,
  nachaTransactionCode,
  nextFileIdModifier,
  parseAchOriginator,
  readAchOriginatorDraft,
  toPublicAchOriginator,
  type AchOriginatorConfig,
  type NachaEntryInput,
} from '../nacha';

const TEST_ROUTING = '021000021';

function originator(overrides: Partial<AchOriginatorConfig> = {}): AchOriginatorConfig {
  return {
    destinationRouting: TEST_ROUTING,
    destinationName: 'TEST DEST BANK',
    companyName: 'TEST ORIGINATOR',
    companyId: '1234567890',
    odfiId: TEST_ROUTING.slice(0, 8),
    secCode: 'PPD',
    fileNamePattern: DEFAULT_NACHA_FILE_NAME_PATTERN,
    settlementRouting: TEST_ROUTING,
    settlementAccount: '555667788',
    settlementAccountType: 'checking',
    ...overrides,
  };
}

function charge(overrides: Partial<NachaEntryInput> = {}): NachaEntryInput {
  return {
    transactionId: '11111111-1111-1111-1111-111111111111',
    transactionType: 'charge',
    amountCents: 1000,
    routingNumber: TEST_ROUTING,
    accountNumber: '123456789',
    accountType: 'checking',
    individualName: 'Jane Doe',
    individualId: '11111111-1111-1111-1111-111111111111',
    accountLast4: '6789',
    ...overrides,
  };
}

function refund(overrides: Partial<NachaEntryInput> = {}): NachaEntryInput {
  return {
    transactionId: '22222222-2222-2222-2222-222222222222',
    transactionType: 'refund',
    amountCents: 1000,
    routingNumber: TEST_ROUTING,
    accountNumber: '987654321',
    accountType: 'checking',
    individualName: 'John Roe',
    individualId: '22222222-2222-2222-2222-222222222222',
    accountLast4: '4321',
    ...overrides,
  };
}

describe('parseAchOriginator', () => {
  it('fails closed when any required field is missing', () => {
    expect(() => parseAchOriginator({})).toThrow(NachaConfigError);
    try {
      parseAchOriginator({ companyName: 'PAY IT FORWARD H' });
    } catch (error) {
      expect(error).toBeInstanceOf(NachaConfigError);
      expect((error as NachaConfigError).missing.length).toBeGreaterThan(0);
    }
  });

  it('rejects an invalid ABA routing number and a mismatched ODFI', () => {
    expect(() =>
      parseAchOriginator({
        ...originator(),
        destinationRouting: '123456789',
      }),
    ).toThrow(/invalid ABA/);

    expect(() =>
      parseAchOriginator({
        ...originator(),
        odfiId: '99999999',
      }),
    ).toThrow(/first 8 digits/);
  });

  it('parses a complete config and masks the settlement account', () => {
    const parsed = parseAchOriginator(JSON.stringify(originator()));
    expect(parsed.secCode).toBe('PPD');
    const pub = toPublicAchOriginator(parsed);
    expect(pub.complete).toBe(true);
    expect(pub.settlementAccountMasked).toBe('****7788');
    expect(pub.settlementAccountLast4).toBe('7788');
  });

  it('reads a draft without exposing the full settlement account', () => {
    const draft = readAchOriginatorDraft(originator());
    expect(draft.companyName).toBe('TEST ORIGINATOR');
    expect(draft.settlementAccountMasked).toBe('****7788');
    expect(draft).not.toHaveProperty('settlementAccount');
    expect(missingAchOriginatorFields({})).toContain('destinationRouting');
  });

  it('keeps an existing settlement account when the form posts a mask', () => {
    const existing = originator();
    const merged = mergeAchOriginatorInput(
      { ...existing, settlementAccount: '****7788' },
      existing,
    );
    expect(parseAchOriginator(merged).settlementAccount).toBe('555667788');
  });
});

describe('generateNachaFile', () => {
  const createdAt = new Date(Date.UTC(2026, 8, 20, 18, 30, 45));

  it('emits 94-char CRLF records, matching hash and balanced totals', () => {
    const file = generateNachaFile({
      originator: originator(),
      entries: [charge(), refund()],
      effectiveDate: '2026-09-22',
      createdAt,
      fileIdModifier: 'A',
    });

    expect(file.lines.every((line) => line.length === 94)).toBe(true);
    expect(file.contents.includes('\n') && !file.contents.includes('\r\n') ? 'LF' : 'CRLF').toBe(
      'CRLF',
    );
    expect(file.contents.endsWith('\r\n')).toBe(true);
    expect(file.debitCents).toBe(1000);
    expect(file.creditCents).toBe(1000);
    expect(file.debitCents).toBe(file.creditCents);
    expect(file.serviceClassCode).toBe('225');
    expect(file.entryHash).toBe((2100002 + 2100002) % 10_000_000_000);
    expect(file.fileName).toBe('NACHA_20260920_183045.txt');

    const header = file.lines[0];
    expect(header[0]).toBe('1');
    expect(header.slice(3, 13)).toBe(` ${TEST_ROUTING}`);
    expect(header.slice(13, 23)).toBe('1234567890');
    expect(header[33]).toBe('A');

    const batch = file.lines[1];
    expect(batch.slice(0, 4)).toBe('5225');
    expect(batch.slice(50, 53)).toBe('PPD');

    expect(file.lines[2].slice(1, 3)).toBe('27');
    expect(file.lines[3].slice(1, 3)).toBe('22');
    expect(file.traces[0].traceNumber).toBe(`${TEST_ROUTING.slice(0, 8)}0000001`);
    expect(file.traces[1].accountLast4).toBe('4321');

    const control = file.lines[4];
    expect(control[0]).toBe('8');
    expect(control.slice(20, 32)).toBe('000000001000');
    expect(control.slice(32, 44)).toBe('000000001000');

    expect(file.lines.length % 10).toBe(0);
    expect(file.lines.at(-1)?.startsWith('9')).toBe(true);
  });

  it('maps charge/refund and checking/savings to NACHA transaction codes', () => {
    expect(nachaTransactionCode('charge', 'checking')).toBe('27');
    expect(nachaTransactionCode('charge', 'savings')).toBe('37');
    expect(nachaTransactionCode('refund', 'checking')).toBe('22');
    expect(nachaTransactionCode('refund', 'savings')).toBe('32');

    const file = generateNachaFile({
      originator: originator(),
      entries: [refund({ accountType: 'savings', amountCents: 250 })],
      effectiveDate: '2026-09-22',
      createdAt,
      fileIdModifier: 'A',
    });
    expect(file.serviceClassCode).toBe('225');
    expect(file.lines[2].slice(1, 3)).toBe('32');
    expect(file.lines[3].slice(1, 3)).toBe('27');
    expect(file.debitCents).toBe(file.creditCents);
    expect(file.traces.at(-1)?.transactionId).toBe(NACHA_BALANCING_ENTRY_ID);
  });

  it('adds a settlement credit when member charges do not already balance', () => {
    const file = generateNachaFile({
      originator: originator(),
      entries: [charge({ amountCents: 1500 })],
      effectiveDate: '2026-09-22',
      createdAt,
      fileIdModifier: 'A',
    });
    expect(file.debitCents).toBe(1500);
    expect(file.creditCents).toBe(1500);
    expect(file.serviceClassCode).toBe('225');
    expect(file.lines[3].slice(1, 3)).toBe('22');
    expect(file.traces.at(-1)?.accountLast4).toBe('7788');
  });

  it('does not add a second offset when charges and refunds already net to zero', () => {
    const file = generateNachaFile({
      originator: originator(),
      entries: [charge({ amountCents: 800 }), refund({ amountCents: 800 })],
      effectiveDate: '2026-09-22',
      createdAt,
      fileIdModifier: 'A',
    });
    expect(file.traces.some((trace) => trace.transactionId === NACHA_BALANCING_ENTRY_ID)).toBe(false);
    expect(file.traces).toHaveLength(2);
  });

  it('refuses to invent a last4-only settlement offset', () => {
    expect(() =>
      generateNachaFile({
        originator: originator({ settlementAccount: '7788' }),
        entries: [charge()],
        effectiveDate: '2026-09-22',
        fileIdModifier: 'A',
      }),
    ).toThrow(/last4-only/);
  });

  it('rejects last4-only and zero-padded last4 account numbers', () => {
    expect(isLast4OnlyAccount('1234')).toBe(true);
    expect(isLast4OnlyAccount('00000000000001234')).toBe(true);
    expect(isLast4OnlyAccount('6789', '6789')).toBe(true);
    expect(isLast4OnlyAccount('123456789', '6789')).toBe(false);

    expect(() =>
      generateNachaFile({
        originator: originator(),
        entries: [charge({ accountNumber: '6789' })],
        effectiveDate: '2026-09-22',
        fileIdModifier: 'A',
      }),
    ).toThrow(NachaGenerateError);

    expect(() =>
      generateNachaFile({
        originator: originator(),
        entries: [charge({ accountNumber: '00000000000006789', accountLast4: '6789' })],
        effectiveDate: '2026-09-22',
        fileIdModifier: 'A',
      }),
    ).toThrow(/last4-only/);
  });

  it('increments the File ID Modifier A–Z and stops at 26 files', () => {
    expect(nextFileIdModifier(0)).toBe('A');
    expect(nextFileIdModifier(1)).toBe('B');
    expect(nextFileIdModifier(25)).toBe('Z');
    expect(() => nextFileIdModifier(26)).toThrow(/26 NACHA files/);
  });

});

describe('coalesceAccountLast4', () => {
  it('prefers account_last4 and falls back to last_four', () => {
    expect(coalesceAccountLast4('6789', '0000')).toBe('6789');
    expect(coalesceAccountLast4(null, '1234')).toBe('1234');
    expect(coalesceAccountLast4('', '')).toBeNull();
    expect(coalesceAccountLast4('xx12', null)).toBe('12');
  });
});

describe('maskAccountNumber', () => {
  it('shows only the last four', () => {
    expect(maskAccountNumber('555667788')).toBe('****7788');
  });
});
