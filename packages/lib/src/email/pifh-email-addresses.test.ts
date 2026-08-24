import { describe, expect, it } from 'vitest';
import { inboundReplyTo, pifhInboundEmail } from './pifh-email-addresses';

describe('inboundReplyTo', () => {
  it('rewrites apex senders onto the Resend inbound subdomain', () => {
    expect(inboundReplyTo('wendy@payitforwardhealth.com')).toBe(
      'wendy@mail.payitforwardhealth.com',
    );
    expect(inboundReplyTo('Support@PayItForwardHealth.com')).toBe(
      'support@mail.payitforwardhealth.com',
    );
  });

  it('routes noreply replies to support@mail…', () => {
    expect(inboundReplyTo('noreply@payitforwardhealth.com')).toBe(
      'support@mail.payitforwardhealth.com',
    );
  });

  it('leaves inbound-domain and foreign addresses unchanged', () => {
    expect(inboundReplyTo('support@mail.payitforwardhealth.com')).toBe(
      'support@mail.payitforwardhealth.com',
    );
    expect(inboundReplyTo('kitty@oldglorybank.com')).toBe('kitty@oldglorybank.com');
  });

  it('accepts RFC5322 display-name form', () => {
    expect(inboundReplyTo('Wendy Scipione <wendy@payitforwardhealth.com>')).toBe(
      'wendy@mail.payitforwardhealth.com',
    );
  });

  it('builds inbound addresses from a local part', () => {
    expect(pifhInboundEmail('billing')).toBe('billing@mail.payitforwardhealth.com');
  });
});
