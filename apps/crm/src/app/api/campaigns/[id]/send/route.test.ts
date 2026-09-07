import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest } from '@/test/helpers';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createClient: vi.fn(),
  getAuthProfile: vi.fn(),
  isCommsFlagEnabled: vi.fn(),
  processCampaignEmails: vi.fn(),
  createOutboxProcessorClient: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: mocks.after };
});

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mocks.createClient(),
  getAuthProfile: () => mocks.getAuthProfile(),
}));

vi.mock('@/lib/email/comms-flags', () => ({
  COMMS_FLAGS: {
    killSwitch: 'crm.comms.kill_switch',
    campaignSend: 'crm.comms.campaign_send',
  },
  isCommsFlagEnabled: (...args: unknown[]) => mocks.isCommsFlagEnabled(...args),
}));

vi.mock('@/lib/email/campaign-send', () => ({
  enqueueCampaignEmail: vi.fn(),
  processCampaignEmails: (...args: unknown[]) => mocks.processCampaignEmails(...args),
  createOutboxProcessorClient: () => mocks.createOutboxProcessorClient(),
}));

vi.mock('@/lib/email/outbox-process', () => ({
  processEmailOutbox: vi.fn(),
}));

import { POST } from './route';

function thenableResult(result: Record<string, unknown>) {
  return {
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: Record<string, unknown>) => unknown) => resolve(result),
  };
}

function createCampaignClient(status: 'draft' | 'paused') {
  const campaign = {
    id: 'campaign-1',
    org_id: 'org-1',
    status,
    from_email: 'campaign@example.com',
    subject: 'Coverage update',
  };

  const readQuery = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: campaign, error: null }),
  };
  const updateQuery = thenableResult({ error: null });
  const recipientQuery = thenableResult({ count: 2, error: null });

  return {
    campaign,
    client: {
      from: vi.fn((table: string) => {
        if (table === 'email_campaigns') {
          return {
            select: vi.fn(() => readQuery),
            update: vi.fn(() => updateQuery),
          };
        }
        if (table === 'email_campaign_recipients') {
          return { select: vi.fn(() => recipientQuery) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
  };
}

describe('POST /api/campaigns/[id]/send orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthProfile.mockResolvedValue(buildProfile());
    mocks.isCommsFlagEnabled
      .mockResolvedValueOnce(false) // kill switch
      .mockResolvedValueOnce(true); // campaign send gate
    mocks.processCampaignEmails.mockResolvedValue({ sent: 2, failed: 0 });
    mocks.createOutboxProcessorClient.mockReturnValue({ service: true });
  });

  it.each(['draft', 'paused'] as const)(
    'registers %s campaign fan-out with the serverless lifecycle',
    async (status) => {
      const { campaign, client } = createCampaignClient(status);
      mocks.createClient.mockResolvedValue(client);
      let backgroundTask: (() => Promise<void>) | undefined;
      mocks.after.mockImplementation((callback: () => Promise<void>) => {
        backgroundTask = callback;
      });

      const response = await POST(
        buildRequest('http://localhost/api/campaigns/campaign-1/send', {
          method: 'POST',
        }),
        { params: Promise.resolve({ id: 'campaign-1' }) },
      );

      expect(response.status).toBe(200);
      expect(mocks.after).toHaveBeenCalledOnce();
      expect(mocks.processCampaignEmails).not.toHaveBeenCalled();

      await backgroundTask?.();

      expect(mocks.processCampaignEmails).toHaveBeenCalledWith(
        { service: true },
        campaign,
        'org-1',
      );
    },
  );
});
