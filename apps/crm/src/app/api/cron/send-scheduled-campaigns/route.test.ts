import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest } from '@/test/helpers';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyCronSecret: vi.fn(),
  isCommsFlagEnabled: vi.fn(),
  processCampaignEmails: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mocks.createClient(...args),
}));

vi.mock('@/lib/security/verify-cron-secret', () => ({
  verifyCronSecret: (...args: unknown[]) => mocks.verifyCronSecret(...args),
}));

vi.mock('@/lib/email/comms-flags', () => ({
  COMMS_FLAGS: {
    killSwitch: 'crm.comms.kill_switch',
    campaignSend: 'crm.comms.campaign_send',
  },
  isCommsFlagEnabled: (...args: unknown[]) => mocks.isCommsFlagEnabled(...args),
}));

vi.mock('@/lib/email/campaign-send', () => ({
  processCampaignEmails: (...args: unknown[]) => mocks.processCampaignEmails(...args),
}));

import { POST } from './route';

function createRecoveryClient() {
  const staleCampaign = {
    id: 'campaign-stale',
    org_id: 'org-1',
    status: 'sending',
    updated_at: '2026-09-07T10:00:00.000Z',
  };
  const claimEqCalls: Array<[string, unknown]> = [];

  class SelectQuery implements PromiseLike<{ data: typeof staleCampaign[]; error: null }> {
    private status: string | null = null;

    eq(column: string, value: unknown) {
      if (column === 'status') this.status = String(value);
      return this;
    }

    lte() {
      return this;
    }

    lt() {
      return this;
    }

    order() {
      return this;
    }

    limit() {
      return this;
    }

    then<TResult1 = { data: typeof staleCampaign[]; error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: typeof staleCampaign[]; error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      const result = {
        data: this.status === 'sending' ? [staleCampaign] : [],
        error: null,
      };
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  const claim = {
    eq(column: string, value: unknown) {
      claimEqCalls.push([column, value]);
      return claim;
    },
    select() {
      return claim;
    },
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: staleCampaign.id },
      error: null,
    }),
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'email_campaigns') throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => new SelectQuery()),
        update: vi.fn(() => claim),
      };
    }),
  };

  return { claimEqCalls, client, staleCampaign };
}

describe('scheduled campaign recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    mocks.verifyCronSecret.mockReturnValue(null);
    mocks.isCommsFlagEnabled
      .mockResolvedValueOnce(false) // kill switch
      .mockResolvedValueOnce(true); // campaign send gate
    mocks.processCampaignEmails.mockResolvedValue({ sent: 1, failed: 0 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reclaims a stale sending campaign with a compare-and-swap', async () => {
    const { claimEqCalls, client, staleCampaign } = createRecoveryClient();
    mocks.createClient.mockReturnValue(client);

    const response = await POST(
      buildRequest('http://localhost/api/cron/send-scheduled-campaigns', {
        method: 'POST',
        headers: { authorization: 'Bearer test' },
      }),
    );

    expect(response.status).toBe(200);
    expect(claimEqCalls).toContainEqual(['status', 'sending']);
    expect(claimEqCalls).toContainEqual(['updated_at', staleCampaign.updated_at]);
    expect(mocks.processCampaignEmails).toHaveBeenCalledWith(
      client,
      staleCampaign,
      'org-1',
    );
  });
});
