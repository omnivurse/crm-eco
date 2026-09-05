import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueOutbox } from '@/lib/email/outbox';
import { processEmailOutbox } from '@/lib/email/outbox-process';
import { processCampaignEmails } from './campaign-send';

vi.mock('@/lib/email/outbox', () => ({
  createOutboxAdminClient: vi.fn(() => ({})),
  enqueueOutbox: vi.fn(async () => ({ row: { id: 'outbox-row' }, reused: false })),
}));

vi.mock('@/lib/email/outbox-process', () => ({
  processEmailOutbox: vi.fn(async () => ({
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  })),
}));

type Recipient = {
  id: string;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
};

function createCampaignClient(recipientCount: number) {
  const recipients: Recipient[] = Array.from({ length: recipientCount }, (_, index) => ({
    id: `recipient-${String(index).padStart(4, '0')}`,
    email: `recipient-${index}@example.com`,
    status: 'pending',
  }));
  const campaignUpdates: Array<Record<string, unknown>> = [];

  class SelectQuery {
    private filters = new Map<string, unknown>();

    constructor(private readonly table: string) {}

    eq(column: string, value: unknown) {
      this.filters.set(column, value);
      return this;
    }

    order() {
      return this;
    }

    async range(from: number, to: number) {
      if (this.table !== 'email_campaign_recipients') {
        throw new Error(`Unexpected range query for ${this.table}`);
      }

      const status = this.filters.get('status');
      const matching = recipients.filter((recipient) => !status || recipient.status === status);
      return { data: matching.slice(from, to + 1), error: null };
    }

    async maybeSingle() {
      if (this.table === 'email_campaigns') {
        return { data: { status: 'sending' }, error: null };
      }
      if (this.table === 'email_unsubscribes') {
        return { data: null, error: null };
      }
      throw new Error(`Unexpected maybeSingle query for ${this.table}`);
    }
  }

  class UpdateQuery implements PromiseLike<{ data: null; error: null }> {
    private filters = new Map<string, unknown>();

    constructor(
      private readonly table: string,
      private readonly patch: Record<string, unknown>,
    ) {}

    eq(column: string, value: unknown) {
      this.filters.set(column, value);
      return this;
    }

    async in(column: string, values: string[]) {
      if (this.table !== 'email_campaign_recipients' || column !== 'id') {
        throw new Error(`Unexpected update for ${this.table}.${column}`);
      }

      const ids = new Set(values);
      for (const recipient of recipients) {
        if (ids.has(recipient.id)) Object.assign(recipient, this.patch);
      }
      return { data: null, error: null };
    }

    then<TResult1 = { data: null; error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      if (this.table === 'email_campaigns') campaignUpdates.push(this.patch);
      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
    }
  }

  const client = {
    from(table: string) {
      return {
        select: () => new SelectQuery(table),
        update: (patch: Record<string, unknown>) => new UpdateQuery(table, patch),
      };
    },
  };

  return { campaignUpdates, client, recipients };
}

describe('processCampaignEmails', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    vi.mocked(enqueueOutbox).mockClear();
    vi.mocked(processEmailOutbox).mockClear();
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
      callback();
      return 0;
    }) as typeof setTimeout);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not skip pending recipients when the first page changes status', async () => {
    // Regression: after these first 500 rows became sent, querying offset 500
    // against the shrinking pending set skipped recipient 501 and still marked
    // the campaign sent.
    const { campaignUpdates, client, recipients } = createCampaignClient(501);

    const result = await processCampaignEmails(
      client,
      {
        id: 'campaign-1',
        from_email: 'campaign@example.com',
        subject: 'Hello',
        body_html: '<p>Hello</p>',
      },
      'org-1',
    );

    expect(result).toEqual({ sent: 501, failed: 0 });
    expect(vi.mocked(enqueueOutbox)).toHaveBeenCalledTimes(501);
    expect(recipients.every((recipient) => recipient.status === 'sent')).toBe(true);
    expect(campaignUpdates.at(-1)).toMatchObject({
      status: 'sent',
      sent_count: 501,
      failed_count: 0,
    });
  });

  it('moves a rejected enqueue out of the pending page', async () => {
    const { client, recipients } = createCampaignClient(1);
    vi.mocked(enqueueOutbox).mockRejectedValueOnce(new Error('outbox unavailable'));

    const result = await processCampaignEmails(
      client,
      {
        id: 'campaign-1',
        from_email: 'campaign@example.com',
        subject: 'Hello',
        body_html: '<p>Hello</p>',
      },
      'org-1',
    );

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(recipients[0].status).toBe('failed');
  });
});
