import { describe, expect, it, vi } from 'vitest';
import {
  claimOutboxBatch,
  classifyProviderError,
  markOutboxAccepted,
  markOutboxSubmitting,
  nextAttemptAt,
  outboxAlreadyAccepted,
} from './outbox';

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

  it('fails when provider acceptance cannot be persisted', async () => {
    const chain: Record<string, any> = {};
    for (const method of ['update', 'eq', 'select']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));

    await expect(
      markOutboxAccepted(
        { from: vi.fn(() => chain) },
        'outbox-1',
        'org-1',
        'sendgrid',
        'provider-1',
      ),
    ).rejects.toThrow(/persist provider acceptance/i);
  });

  it('persists the provider before submission begins', async () => {
    const chain: Record<string, any> = {};
    for (const method of ['update', 'eq', 'select']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.maybeSingle = vi.fn(async () => ({ data: { id: 'outbox-1' }, error: null }));

    await markOutboxSubmitting(
      { from: vi.fn(() => chain) },
      'outbox-1',
      'org-1',
      'sendgrid',
    );

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'provider_submitting',
        provider: 'sendgrid',
      }),
    );
  });

  it('automatically reclaims ambiguous submissions only for idempotent Resend', async () => {
    const queries: Array<{
      eqCalls: Array<[string, unknown]>;
      inCalls: Array<[string, unknown[]]>;
    }> = [];
    const client = {
      from: vi.fn(() => {
        const calls = {
          eqCalls: [] as Array<[string, unknown]>,
          inCalls: [] as Array<[string, unknown[]]>,
        };
        queries.push(calls);
        const chain: Record<string, any> = {};
        for (const method of ['select', 'lte', 'lt', 'order']) {
          chain[method] = vi.fn(() => chain);
        }
        chain.eq = vi.fn((column: string, value: unknown) => {
          calls.eqCalls.push([column, value]);
          return chain;
        });
        chain.in = vi.fn((column: string, values: unknown[]) => {
          calls.inCalls.push([column, values]);
          return chain;
        });
        chain.limit = vi.fn(() => chain);
        chain.then = (resolve: (value: { data: unknown[] }) => void) =>
          Promise.resolve({ data: [] }).then(resolve);
        return chain;
      }),
    };

    await expect(claimOutboxBatch(client)).resolves.toEqual([]);

    expect(queries).toHaveLength(3);
    expect(queries[2].eqCalls).toEqual([
      ['status', 'provider_submitting'],
      ['provider', 'resend'],
    ]);
    expect(
      queries.some(({ inCalls }) =>
        inCalls.some(([, statuses]) => statuses.includes('provider_submitting')),
      ),
    ).toBe(false);
  });
});
