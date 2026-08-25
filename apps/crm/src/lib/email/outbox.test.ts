import { describe, expect, it, vi } from 'vitest';
import {
  claimOutboxBatch,
  classifyProviderError,
  nextAttemptAt,
  outboxAlreadyAccepted,
  type OutboxRow,
  type OutboxStatus,
} from './outbox';

function makeOutboxRow(id: string, status: OutboxStatus): OutboxRow {
  return {
    id,
    organization_id: 'org',
    idempotency_key: `key-${id}`,
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
    status,
    attempt_count: 0,
    provider: null,
    provider_message_id: null,
    last_error: null,
    payload: {},
    linked_contact_id: null,
    linked_lead_id: null,
    linked_deal_id: null,
  };
}

function makeQuery(result: { data: unknown; error: { message?: string } | null }) {
  const chain: any = {};
  for (const method of ['select', 'eq', 'lte', 'in', 'order', 'limit', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

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

  it('reclaims expired leases before claiming ready rows', async () => {
    const nowMs = Date.parse('2026-08-23T12:00:00.000Z');
    const expired = makeOutboxRow('expired', 'leased');
    const queued = makeOutboxRow('queued', 'queued');
    const expiredCandidates = makeQuery({ data: [expired], error: null });
    const readyCandidates = makeQuery({ data: [queued], error: null });
    const expiredClaim = makeQuery({
      data: { ...expired, leased_by: 'worker-b' },
      error: null,
    });
    const queuedClaim = makeQuery({
      data: { ...queued, status: 'leased', leased_by: 'worker-b' },
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(expiredCandidates)
      .mockReturnValueOnce(readyCandidates)
      .mockReturnValueOnce(expiredClaim)
      .mockReturnValueOnce(queuedClaim);

    const claimed = await claimOutboxBatch({ from }, 2, 'worker-b', nowMs);

    expect(claimed.map((row) => row.id)).toEqual(['expired', 'queued']);
    expect(expiredCandidates.eq).toHaveBeenCalledWith('status', 'leased');
    expect(expiredCandidates.lte).toHaveBeenCalledWith('leased_until', '2026-08-23T12:00:00.000Z');
    expect(readyCandidates.limit).toHaveBeenCalledWith(1);
    expect(expiredClaim.eq).toHaveBeenCalledWith('status', 'leased');
    expect(expiredClaim.lte).toHaveBeenCalledWith('leased_until', '2026-08-23T12:00:00.000Z');
    expect(queuedClaim.in).toHaveBeenCalledWith('status', ['queued', 'failed']);
  });

  it('does not reclaim a lease renewed by another worker', async () => {
    const nowMs = Date.parse('2026-08-23T12:00:00.000Z');
    const expired = makeOutboxRow('expired', 'leased');
    const expiredCandidates = makeQuery({ data: [expired], error: null });
    const lostRace = makeQuery({ data: null, error: null });
    const from = vi.fn().mockReturnValueOnce(expiredCandidates).mockReturnValueOnce(lostRace);

    const claimed = await claimOutboxBatch({ from }, 1, 'worker-b', nowMs);

    expect(claimed).toEqual([]);
    expect(lostRace.eq).toHaveBeenCalledWith('status', 'leased');
    expect(lostRace.lte).toHaveBeenCalledWith('leased_until', '2026-08-23T12:00:00.000Z');
  });
});
