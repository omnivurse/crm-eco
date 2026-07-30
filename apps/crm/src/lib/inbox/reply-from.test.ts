import { describe, expect, it } from 'vitest';
import { resolveReplyFromAddress } from './reply-from';

const SENDERS = [
  { email: 'noreply@payitforwardhealth.com', isDefault: true },
  { email: 'support@payitforwardhealth.com', isDefault: false },
  { email: 'billing@payitforwardhealth.com', isDefault: false },
  { email: 'enrollment@payitforwardhealth.com', isDefault: false },
];

const DOMAINS = [
  'payitforwardhealth.com',
  'mail.payitforwardhealth.com',
  'info.payitforwardhealth.com',
];

function resolve(overrides: Partial<Parameters<typeof resolveReplyFromAddress>[0]>) {
  return resolveReplyFromAddress({
    senders: SENDERS,
    verifiedDomains: DOMAINS,
    ...overrides,
  });
}

describe('resolveReplyFromAddress', () => {
  it('replies from the mailbox the thread belongs to', () => {
    expect(resolve({ conversationMailbox: 'billing@payitforwardhealth.com' })).toBe(
      'billing@payitforwardhealth.com',
    );
  });

  it('prefers the conversation mailbox over the last inbound recipient', () => {
    // The newest message may have been addressed elsewhere in a forward chain;
    // the thread must not silently change identity mid-conversation.
    expect(
      resolve({
        conversationMailbox: 'enrollment@payitforwardhealth.com',
        lastInboundTo: 'billing@payitforwardhealth.com',
      }),
    ).toBe('enrollment@payitforwardhealth.com');
  });

  it('falls back to the last inbound recipient for legacy untagged threads', () => {
    expect(
      resolve({ conversationMailbox: null, lastInboundTo: 'support@payitforwardhealth.com' }),
    ).toBe('support@payitforwardhealth.com');
  });

  it('rewrites a subdomain arrival to the registered apex sender', () => {
    expect(resolve({ conversationMailbox: 'billing@mail.payitforwardhealth.com' })).toBe(
      'billing@payitforwardhealth.com',
    );
  });

  it('sends as a catch-all address when its domain is verified', () => {
    // owens@ is real inbound traffic but was never registered as a sender.
    expect(resolve({ conversationMailbox: 'owens@payitforwardhealth.com' })).toBe(
      'owens@payitforwardhealth.com',
    );
  });

  it('never sends as a domain the org does not control', () => {
    expect(resolve({ conversationMailbox: 'someone@gmail.com' })).toBe(
      'noreply@payitforwardhealth.com',
    );
  });

  it('falls back to the org default when nothing is resolvable', () => {
    expect(resolve({})).toBe('noreply@payitforwardhealth.com');
  });

  it('unwraps a display-name recipient', () => {
    expect(resolve({ conversationMailbox: 'PIFH Billing <Billing@PayItForwardHealth.com>' })).toBe(
      'billing@payitforwardhealth.com',
    );
  });

  it('uses reply-to only after mailbox and recipient fail', () => {
    expect(
      resolve({
        conversationMailbox: 'stranger@example.org',
        lastInboundTo: 'another@example.org',
        lastInboundReplyTo: 'support@payitforwardhealth.com',
      }),
    ).toBe('support@payitforwardhealth.com');
  });

  it('treats the first sender as default when none is flagged', () => {
    expect(
      resolveReplyFromAddress({
        senders: [{ email: 'support@payitforwardhealth.com', isDefault: false }],
        verifiedDomains: [],
      }),
    ).toBe('support@payitforwardhealth.com');
  });

  it('returns null rather than guessing when the org has no senders', () => {
    expect(resolveReplyFromAddress({ senders: [], verifiedDomains: [] })).toBeNull();
  });
});
