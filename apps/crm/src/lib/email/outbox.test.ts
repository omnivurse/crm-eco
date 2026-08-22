import { describe, expect, it } from 'vitest';
import { classifyProviderError, nextAttemptAt, outboxAlreadyAccepted } from './outbox';

describe('outbox helpers', () => {
  it('classifies 429/5xx as transient and 4xx as permanent', () => {
    expect(classifyProviderError(429)).toBe('transient');
    expect(classifyProviderError(503)).toBe('transient');
    expect(classifyProviderError(400, 'invalid from')).toBe('permanent');
    expect(classifyProviderError(null, 'timeout contacting provider')).toBe('transient');
  });

  it('backs off retries', () => {
    const first = Date.parse(nextAttemptAt(0, 0));
    const second = Date.parse(nextAttemptAt(1, 0));
    expect(second).toBeGreaterThan(first);
  });

  it('treats a prior provider accept as idempotent success', () => {
    expect(
      outboxAlreadyAccepted({
        id: '1',
        organization_id: 'org',
        idempotency_key: 'k',
        sender_address: 'a@x.com',
        from_name: null,
        reply_to: null,
        to_addresses: ['b@x.com'],
        cc_addresses: [],
        bcc_addresses: [],
        subject: 'Hi',
        body_html: null,
        body_text: null,
        conversation_id: null,
        status: 'sent',
        attempt_count: 1,
        provider: 'resend',
        provider_message_id: 're_123',
        last_error: null,
        payload: {},
        linked_contact_id: null,
        linked_lead_id: null,
        linked_deal_id: null,
      }),
    ).toBe(true);
  });
});
