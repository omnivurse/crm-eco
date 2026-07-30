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
    expect(safeCrmRedirect('javascript:alert(1)')).toBe('/crm');
  });

  it('blocks backslash and control-character smuggling past the /crm prefix', () => {
    // Browsers normalise these inconsistently, so a path that merely *starts*
    // with /crm can still resolve to another host.
    expect(safeCrmRedirect('/crm\\@evil.test')).toBe('/crm');
    expect(safeCrmRedirect('/crm\\\\evil.test')).toBe('/crm');
    expect(safeCrmRedirect('/crm\nLocation: https://evil.test')).toBe('/crm');
    expect(safeCrmRedirect('/crm\r\nSet-Cookie: a=b')).toBe('/crm');
    expect(safeCrmRedirect('/crm\u0000')).toBe('/crm');
  });

  it('still allows legitimate query strings', () => {
    expect(safeCrmRedirect('/crm/settings?tab=security')).toBe(
      '/crm/settings?tab=security',
    );
  });
});
