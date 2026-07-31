import { describe, it, expect } from 'vitest';
import {
  hasVerifiedTotpFactor,
  isMfaEnforcementEnabled,
  isMfaStepUpRequired,
  readAalFromAccessToken,
  MFA_STEP_UP_PATH,
} from './mfa';

/** Build a syntactically valid JWT whose payload carries the given claims. */
function makeToken(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('isMfaEnforcementEnabled', () => {
  it('is off unless explicitly set to the string "true"', () => {
    expect(isMfaEnforcementEnabled({})).toBe(false);
    expect(isMfaEnforcementEnabled({ CRM_ENFORCE_MFA: 'false' })).toBe(false);
    expect(isMfaEnforcementEnabled({ CRM_ENFORCE_MFA: '1' })).toBe(false);
    expect(isMfaEnforcementEnabled({ CRM_ENFORCE_MFA: 'TRUE' })).toBe(false);
    expect(isMfaEnforcementEnabled({ CRM_ENFORCE_MFA: 'true' })).toBe(true);
  });
});

describe('hasVerifiedTotpFactor', () => {
  it('requires a factor that is both TOTP and verified', () => {
    expect(hasVerifiedTotpFactor([{ factor_type: 'totp', status: 'verified' }])).toBe(true);
  });

  it('ignores half-finished enrollments so nobody locks themselves out', () => {
    expect(hasVerifiedTotpFactor([{ factor_type: 'totp', status: 'unverified' }])).toBe(false);
  });

  it('handles missing, empty, and unrelated factor lists', () => {
    expect(hasVerifiedTotpFactor(null)).toBe(false);
    expect(hasVerifiedTotpFactor(undefined)).toBe(false);
    expect(hasVerifiedTotpFactor([])).toBe(false);
    expect(hasVerifiedTotpFactor([{ factor_type: 'phone', status: 'verified' }])).toBe(false);
  });
});

describe('readAalFromAccessToken', () => {
  it('reads aal1 and aal2 out of the payload', () => {
    expect(readAalFromAccessToken(makeToken({ aal: 'aal1' }))).toBe('aal1');
    expect(readAalFromAccessToken(makeToken({ aal: 'aal2' }))).toBe('aal2');
  });

  it('returns null for absent, unknown, or malformed values', () => {
    expect(readAalFromAccessToken(makeToken({ sub: 'user-1' }))).toBeNull();
    expect(readAalFromAccessToken(makeToken({ aal: 'aal3' }))).toBeNull();
    expect(readAalFromAccessToken(null)).toBeNull();
    expect(readAalFromAccessToken(undefined)).toBeNull();
    expect(readAalFromAccessToken('')).toBeNull();
    expect(readAalFromAccessToken('not-a-jwt')).toBeNull();
    expect(readAalFromAccessToken('header.%%%not-base64%%%.sig')).toBeNull();
  });
});

describe('isMfaStepUpRequired', () => {
  it('diverts an AAL1 session that has a verified factor', () => {
    expect(
      isMfaStepUpRequired({ enforced: true, hasVerifiedFactor: true, aal: 'aal1' }),
    ).toBe(true);
  });

  it('lets an AAL2 session through', () => {
    expect(
      isMfaStepUpRequired({ enforced: true, hasVerifiedFactor: true, aal: 'aal2' }),
    ).toBe(false);
  });

  it('never affects users without a verified factor', () => {
    expect(
      isMfaStepUpRequired({ enforced: true, hasVerifiedFactor: false, aal: 'aal1' }),
    ).toBe(false);
  });

  it('is inert while enforcement is disabled', () => {
    expect(
      isMfaStepUpRequired({ enforced: false, hasVerifiedFactor: true, aal: 'aal1' }),
    ).toBe(false);
  });

  it('fails to current behaviour when the assurance level is unreadable', () => {
    // A claim-parsing regression must not lock every MFA user out of the app.
    expect(
      isMfaStepUpRequired({ enforced: true, hasVerifiedFactor: true, aal: null }),
    ).toBe(false);
  });
});

describe('MFA_STEP_UP_PATH', () => {
  it('sits under /crm-login so the public-route guard cannot bounce it', () => {
    // Middleware treats anything under /crm-login as public; if the step-up page
    // lived elsewhere the auth redirect would ping-pong forever.
    expect(MFA_STEP_UP_PATH.startsWith('/crm-login')).toBe(true);
  });
});
