import { describe, expect, it } from 'vitest';
import {
  AchVaultError,
  achVaultSettingKey,
  decryptAchBankDetails,
  encryptAchBankDetails,
  normalizeAchBankDetails,
} from '../ach-vault';

const TEST_ENV = {
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
} as NodeJS.ProcessEnv;

const VALID = {
  routingNumber: '021000021',
  accountNumber: '123456789',
  accountType: 'checking' as const,
};

describe('normalizeAchBankDetails', () => {
  it('accepts a valid consumer checking account', () => {
    expect(normalizeAchBankDetails(VALID)).toEqual({
      routingNumber: '021000021',
      accountNumber: '123456789',
      accountType: 'checking',
      last4: '6789',
    });
  });

  it('rejects invalid ABA, last4-only, and business checking', () => {
    expect(() => normalizeAchBankDetails({ ...VALID, routingNumber: '123456789' })).toThrow(
      AchVaultError,
    );
    expect(() => normalizeAchBankDetails({ ...VALID, accountNumber: '00006789' })).toThrow(/Last4/);
    expect(() =>
      normalizeAchBankDetails({ ...VALID, accountType: 'businessChecking' }),
    ).toThrow(/PPD/);
  });
});

describe('encryptAchBankDetails', () => {
  it('round-trips and never embeds plaintext account digits in the blob', () => {
    const details = normalizeAchBankDetails(VALID);
    const blob = encryptAchBankDetails(details, TEST_ENV);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(blob.includes('123456789')).toBe(false);
    expect(decryptAchBankDetails(blob, TEST_ENV)).toEqual(details);
  });

  it('fails closed without a key and on a wrong key', () => {
    expect(() => encryptAchBankDetails(normalizeAchBankDetails(VALID), {} as NodeJS.ProcessEnv)).toThrow(
      /ACH_VAULT_KEY/,
    );
    const blob = encryptAchBankDetails(normalizeAchBankDetails(VALID), TEST_ENV);
    expect(() =>
      decryptAchBankDetails(blob, { ENCRYPTION_KEY: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' }),
    ).toThrow(AchVaultError);
  });
});

describe('vault to NACHA', () => {
  it('decrypts details that a NACHA entry can use without inventing last4', () => {
    const details = normalizeAchBankDetails(VALID);
    const blob = encryptAchBankDetails(details, TEST_ENV);
    const hydrated = decryptAchBankDetails(blob, TEST_ENV);
    expect(hydrated.routingNumber).toBe('021000021');
    expect(hydrated.accountNumber).toBe('123456789');
    expect(hydrated.accountNumber.endsWith(hydrated.last4)).toBe(true);
    expect(hydrated.accountNumber).not.toBe(hydrated.last4);
  });
});

describe('achVaultSettingKey', () => {
  it('namespaces the payment profile id', () => {
    expect(achVaultSettingKey('11111111-1111-1111-1111-111111111111')).toBe(
      'ach_vault.11111111-1111-1111-1111-111111111111',
    );
  });
});
