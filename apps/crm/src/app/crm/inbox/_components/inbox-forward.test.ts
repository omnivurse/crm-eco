import { describe, expect, it } from 'vitest';
import type { InboxMessage } from '@/lib/inbox/types';
import {
  buildForwardedBody,
  forwardSubject,
  pickForwardSource,
} from './inbox-forward';

const inbound = {
  id: 'm1',
  direction: 'inbound',
  from_name: 'Kitty',
  from_address: 'kitty@example.com',
  subject: 'Coverage question',
  body_html:
    '<!DOCTYPE html><html><head><script>alert(1)</script></head><body><p>Can you help?</p></body></html>',
  body_text: 'Can you help?',
  sent_at: '2026-09-01T12:00:00.000Z',
  attachments: [],
} as InboxMessage;

describe('forwardSubject', () => {
  it('prefixes once', () => {
    expect(forwardSubject('Coverage question')).toBe('Fwd: Coverage question');
    expect(forwardSubject('Fwd: Coverage question')).toBe('Fwd: Coverage question');
  });
});

describe('pickForwardSource', () => {
  it('prefers the last inbound when nothing has files', () => {
    const outbound = { ...inbound, id: 'm2', direction: 'outbound' as const };
    expect(pickForwardSource([inbound, outbound])?.id).toBe('m1');
  });
});

describe('buildForwardedBody', () => {
  it('quotes the body fragment, not a nested full document', () => {
    const html = buildForwardedBody(inbound, '');
    expect(html).toContain('---------- Forwarded message ----------');
    expect(html).toContain('Can you help?');
    expect(html).not.toContain('<!DOCTYPE');
    expect(html).not.toContain('<script');
  });
});
