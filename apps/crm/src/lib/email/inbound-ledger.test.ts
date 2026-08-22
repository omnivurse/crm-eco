import { describe, expect, it } from 'vitest';
import { inboundEventHash } from './inbound-ledger';

describe('inboundEventHash', () => {
  it('is stable for the same event and changes when ids differ', () => {
    const a = inboundEventHash({
      provider: 'resend',
      eventId: 'email_1',
      messageId: '<m@x>',
      from: 'a@x.com',
      to: ['support@x.com'],
    });
    const b = inboundEventHash({
      provider: 'resend',
      eventId: 'email_1',
      messageId: '<m@x>',
      from: 'a@x.com',
      to: ['support@x.com'],
    });
    const c = inboundEventHash({
      provider: 'resend',
      eventId: 'email_2',
      messageId: '<m@x>',
      from: 'a@x.com',
      to: ['support@x.com'],
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });
});
