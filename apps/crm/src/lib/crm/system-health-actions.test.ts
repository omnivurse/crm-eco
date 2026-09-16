import { describe, expect, it } from 'vitest';
import {
  healthCheckAnchor,
  issuesNeedingAttention,
  remediationFor,
} from './system-health-actions';

describe('remediationFor', () => {
  it('gives a parked-mail queue for the undelivered-mail fail (the live critical)', () => {
    const rem = remediationFor('undelivered-mail', 'fail');
    expect(rem).not.toBeNull();
    expect(rem?.href).toBe('/crm/settings/system-health?tab=mail');
    expect(rem?.hrefLabel).toMatch(/parked mail/i);
    expect(rem?.action).toMatch(/Email Domains/i);
  });

  it('does not invent a next step for a passing check', () => {
    expect(remediationFor('phi-logging', 'pass')).toBeNull();
    expect(remediationFor('undelivered-mail', 'pass')).toBeNull();
  });

  it('sends MFA / session warnings to Security, not a dead end', () => {
    expect(remediationFor('mfa', 'warning')?.href).toBe('/crm/settings/security');
    expect(remediationFor('session', 'warning')?.href).toBe('/crm/settings/security');
  });
});

describe('issuesNeedingAttention', () => {
  it('keeps fail + warning, drops pass, preserves order', () => {
    const issues = issuesNeedingAttention([
      { status: 'pass' as const, name: 'ok' },
      { status: 'fail' as const, name: 'mail' },
      { status: 'warning' as const, name: 'mfa' },
      { status: 'pass' as const, name: 'tls' },
    ]);
    expect(issues.map((i) => i.name)).toEqual(['mail', 'mfa']);
  });
});

describe('healthCheckAnchor', () => {
  it('is a stable fragment the scorecard and the queue can share', () => {
    expect(healthCheckAnchor('undelivered-mail')).toBe('health-check-undelivered-mail');
  });
});
