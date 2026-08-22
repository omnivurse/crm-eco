import { describe, expect, it } from 'vitest';
import {
  evaluatePinLockRequest,
  headersIndicatePinLock,
  isPinLockExemptPath,
  isPinUnlockCookieValid,
  PIN_COOKIE_NAME,
  PIN_COOKIE_NAME_LEGACY,
  PIN_LOCK_PATH,
  PIN_LOCK_PATH_HEADER,
  pinLockRobots,
  sanitizePinLockNext,
  WEBSITE_PIN_PUBLIC_PATHS,
} from '@crm-eco/ui/lib/pin-lock';

describe('sanitizePinLockNext', () => {
  it('rejects protocol-relative and off-site targets', () => {
    expect(sanitizePinLockNext('https://evil.example')).toBe('/');
    expect(sanitizePinLockNext('//evil.example')).toBe('/');
    expect(sanitizePinLockNext('lock')).toBe('/');
  });

  it('rejects a lock-page loop', () => {
    expect(sanitizePinLockNext('/lock')).toBe('/');
    expect(sanitizePinLockNext('/lock?next=/plans')).toBe('/');
  });

  it('keeps same-origin paths and query strings', () => {
    expect(sanitizePinLockNext('/plans?ref=1')).toBe('/plans?ref=1');
  });
});

describe('evaluatePinLockRequest', () => {
  it('redirects the landing page to /lock before HTML can ship', () => {
    expect(
      evaluatePinLockRequest({ pathname: '/', search: '' }),
    ).toEqual({ action: 'redirect', location: PIN_LOCK_PATH, next: '/' });
    expect(
      evaluatePinLockRequest({ pathname: '/plans', search: '?x=1' }),
    ).toEqual({
      action: 'redirect',
      location: PIN_LOCK_PATH,
      next: '/plans?x=1',
    });
  });

  it('does not put internal destinations in the lock URL', () => {
    const decision = evaluatePinLockRequest({
      pathname: '/crm-login',
      search: '',
    });
    expect(decision).toEqual({
      action: 'redirect',
      location: PIN_LOCK_PATH,
      next: '/crm-login',
    });
    expect(decision.action === 'redirect' && decision.location.includes('crm')).toBe(false);
  });

  it('lets a valid unlock cookie through', () => {
    const cookie = String(Date.now() + 60_000);
    expect(
      evaluatePinLockRequest({ pathname: '/', cookieValue: cookie }),
    ).toEqual({ action: 'allow', lockPath: false });
  });

  it('treats an expired cookie as locked', () => {
    expect(
      evaluatePinLockRequest({
        pathname: '/',
        cookieValue: String(Date.now() - 1000),
      }),
    ).toEqual({ action: 'redirect', location: PIN_LOCK_PATH, next: '/' });
  });

  it('serves /lock without a cookie and bounces unlocked visitors off it', () => {
    expect(evaluatePinLockRequest({ pathname: '/lock' })).toEqual({
      action: 'allow',
      lockPath: true,
    });
    expect(
      evaluatePinLockRequest({
        pathname: '/lock',
        cookieValue: String(Date.now() + 60_000),
        nextParam: '/plans',
      }),
    ).toEqual({ action: 'redirect', location: '/plans' });
  });

  it('leaves website legal review paths public', () => {
    expect(
      evaluatePinLockRequest({
        pathname: '/legal/privacy',
        extraExemptPaths: WEBSITE_PIN_PUBLIC_PATHS,
      }),
    ).toEqual({ action: 'allow', lockPath: false });
    expect(
      evaluatePinLockRequest({
        pathname: '/legal/terms',
        extraExemptPaths: WEBSITE_PIN_PUBLIC_PATHS,
      }).action,
    ).toBe('redirect');
  });

  it('does not gate APIs or static files', () => {
    expect(isPinLockExemptPath('/api/webhooks/resend')).toBe(true);
    expect(isPinLockExemptPath('/favicon.ico')).toBe(true);
    expect(isPinUnlockCookieValid(undefined)).toBe(false);
  });
});

describe('pinLockRobots', () => {
  it('disallows every path for every user agent', () => {
    expect(pinLockRobots()).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    });
  });
});

describe('pin lock identifiers', () => {
  it('uses a generic unlock cookie and accepts the legacy name', () => {
    expect(PIN_COOKIE_NAME).toBe('lgq_ok');
    expect(PIN_COOKIE_NAME_LEGACY).toBe('dh_pin_unlocked');
    expect(isPinUnlockCookieValid(String(Date.now() + 60_000))).toBe(true);
  });

  it('recognizes current and legacy lock-path headers', () => {
    expect(headersIndicatePinLock((name) => (name === PIN_LOCK_PATH_HEADER ? '1' : null))).toBe(
      true,
    );
    expect(headersIndicatePinLock((name) => (name === 'x-dh-pin-lock-path' ? '1' : null))).toBe(
      true,
    );
    expect(headersIndicatePinLock(() => null)).toBe(false);
  });
});
