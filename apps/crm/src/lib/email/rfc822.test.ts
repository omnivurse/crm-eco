import { describe, expect, it } from 'vitest';
import {
  buildReplyReferences,
  domainFromEmail,
  generateRfc822MessageId,
  normalizeRfc822Id,
  referencesHeaderValue,
} from './rfc822';

describe('rfc822', () => {
  it('normalizes ids with angle brackets', () => {
    expect(normalizeRfc822Id('abc@x.com')).toBe('<abc@x.com>');
    expect(normalizeRfc822Id('<abc@x.com>')).toBe('<abc@x.com>');
    expect(normalizeRfc822Id('  ')).toBeNull();
  });

  it('generates a Message-ID for the from-domain', () => {
    const id = generateRfc822MessageId(domainFromEmail('support@payitforwardhealth.com'));
    expect(id.startsWith('<')).toBe(true);
    expect(id.endsWith('@payitforwardhealth.com>')).toBe(true);
  });

  it('appends the parent id to References and sets In-Reply-To', () => {
    const result = buildReplyReferences('<parent@x.com>', ['<a@x.com>', '<parent@x.com>']);
    expect(result.inReplyTo).toBe('<parent@x.com>');
    expect(result.references).toEqual(['<a@x.com>', '<parent@x.com>']);
    expect(referencesHeaderValue(result.references)).toBe('<a@x.com> <parent@x.com>');
  });
});
