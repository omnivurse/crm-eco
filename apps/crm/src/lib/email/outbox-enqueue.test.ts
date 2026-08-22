import { describe, expect, it } from 'vitest';
import { enqueueOutbox } from './outbox';

describe('enqueueOutbox', () => {
  it('returns the existing row when the idempotency key already exists', async () => {
    const existing = {
      id: 'outbox-1',
      organization_id: 'org-1',
      idempotency_key: 'campaign/c1/r1',
      status: 'sent',
      provider_message_id: 're_dup',
      provider: 'resend',
      attempt_count: 1,
      to_addresses: ['a@x.com'],
      cc_addresses: [],
      bcc_addresses: [],
      subject: 'Hi',
      payload: {},
    };

    const supabase = {
      from() {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { code: '23505', message: 'duplicate key' },
              }),
            }),
          }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: existing, error: null }),
              }),
            }),
          }),
        };
      },
    };

    const result = await enqueueOutbox(supabase, {
      organizationId: 'org-1',
      idempotencyKey: 'campaign/c1/r1',
      senderAddress: 'from@x.com',
      toAddresses: ['a@x.com'],
      subject: 'Hi',
    });

    expect(result.reused).toBe(true);
    expect(result.row.id).toBe('outbox-1');
    expect(result.row.provider_message_id).toBe('re_dup');
  });
});
