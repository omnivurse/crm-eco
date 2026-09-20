import { describe, expect, it } from 'vitest';
import { AchVaultError } from '../ach-vault';
import {
  NachaReturnParseError,
  applyNocCorrection,
  parseNachaReturnFile,
} from '../nacha-returns';

function rec(chunks: string[]): string {
  const line = chunks.join('');
  if (line.length !== 94) throw new Error(`test record length ${line.length}`);
  return line;
}

function padRight(value: string, len: number): string {
  return value.padEnd(len, ' ');
}

function padLeft(value: string | number, len: number): string {
  return String(value).padStart(len, '0');
}

const ODFI = '02100002';
const TRACE = `${ODFI}0000001`;

function header(fileDate = '260920'): string {
  return rec([
    '1',
    '01',
    ' 021000021',
    '1234567890',
    fileDate,
    '1200',
    'A',
    '094',
    '10',
    '1',
    padRight('TEST DEST BANK', 23),
    padRight('TEST ORIGINATOR', 23),
    '        ',
  ]);
}

function batch(effective = '260921'): string {
  return rec([
    '5',
    '225',
    padRight('TEST ORIGINATOR', 16),
    padRight('', 20),
    '1234567890',
    'PPD',
    padRight('RETURN', 10),
    '260920',
    effective,
    '   ',
    '1',
    ODFI,
    '0000001',
  ]);
}

function entry(amountCents = 1000): string {
  return rec([
    '6',
    '26',
    '02100002',
    '1',
    padRight('123456789', 17),
    padLeft(amountCents, 10),
    padRight('MEM1', 15),
    padRight('JANE DOE', 22),
    '  ',
    '0',
    `${ODFI}0000099`,
  ]);
}

function returnAddenda(code = 'R01', originalTrace = TRACE): string {
  return rec([
    '7',
    '99',
    code,
    originalTrace,
    '      ',
    '02100002',
    padRight('NSF', 44),
    ODFI,
    '0000099',
  ]);
}

function nocAddenda(code: string, corrected: string, originalTrace = TRACE): string {
  return rec([
    '7',
    '98',
    code,
    originalTrace,
    '      ',
    '02100002',
    padRight(corrected, 29),
    padRight('', 15),
    ODFI,
    '0000099',
  ]);
}

function file(lines: string[]): string {
  return `${lines.join('\r\n')}\r\n`;
}

describe('parseNachaReturnFile', () => {
  it('parses an R01 return and keeps the original 15-digit trace', () => {
    const parsed = parseNachaReturnFile(file([header(), batch(), entry(), returnAddenda()]));
    expect(parsed.fileDate).toBe('2026-09-21');
    expect(parsed.returnCount).toBe(1);
    expect(parsed.nocCount).toBe(0);
    expect(parsed.entries[0]).toMatchObject({
      kind: 'return',
      originalTrace: TRACE,
      code: 'R01',
      reason: 'Insufficient funds',
      amountCents: 1000,
      accountLast4: '6789',
    });
  });

  it('parses a C01 NOC without inventing account digits', () => {
    const parsed = parseNachaReturnFile(
      file([header(), batch(), entry(), nocAddenda('C01', '9988776655')]),
    );
    expect(parsed.entries[0]).toMatchObject({
      kind: 'noc',
      code: 'C01',
      originalTrace: TRACE,
    });
    expect(parsed.entries[0].correctedData.startsWith('9988776655')).toBe(true);
  });

  it('rejects non-94 records, missing addenda, and last4-looking traces', () => {
    expect(() => parseNachaReturnFile('short\n')).toThrow(NachaReturnParseError);
    expect(() => parseNachaReturnFile(file([header(), batch(), entry()]))).toThrow(/addenda/);
    expect(() =>
      parseNachaReturnFile(file([header(), batch(), entry(), returnAddenda('R01', '02100002000000X')])),
    ).toThrow(/15 digits/);
  });
});

describe('applyNocCorrection', () => {
  const existing = {
    routingNumber: '021000021',
    accountNumber: '123456789',
    accountType: 'checking' as const,
    last4: '6789',
  };

  it('applies C01 account and C02 routing from the 29-char corrected field', () => {
    expect(applyNocCorrection(existing, 'C01', padRight('555667788', 29))).toMatchObject({
      accountNumber: '555667788',
      last4: '7788',
      routingNumber: '021000021',
    });
    expect(applyNocCorrection(existing, 'C02', padRight('121000248', 29)).routingNumber).toBe(
      '121000248',
    );
  });

  it('refuses last4-only NOC corrections', () => {
    expect(() => applyNocCorrection(existing, 'C01', padRight('6789', 29))).toThrow(AchVaultError);
    expect(() => applyNocCorrection(existing, 'C01', padRight('00006789', 29))).toThrow(/last4/i);
  });
});
