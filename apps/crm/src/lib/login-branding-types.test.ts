import { describe, expect, it } from 'vitest';
import { safeCrmRedirect } from './login-branding-types';

describe('safeCrmRedirect', () => {
  it('defaults to /crm', () => {
    expect(safeCrmRedirect(null)).toBe('/crm');
    expect(safeCrmRedirect(undefined)).toBe('/crm');
  });

  it('allows CRM in-app paths', () => {
    expect(safeCrmRedirect('/crm/modules/leads')).toBe('/crm/modules/leads');
    expect(safeCrmRedirect('/crm/r/abc')).toBe('/crm/r/abc');
  });

  it('blocks open redirects', () => {
    expect(safeCrmRedirect('https://evil.test')).toBe('/crm');
    expect(safeCrmRedirect('//evil.test/crm')).toBe('/crm');
    expect(safeCrmRedirect('/admin')).toBe('/crm');
  });
});
