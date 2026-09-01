import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createLog: vi.fn(),
  enqueueOutbox: vi.fn(),
  isCommsFlagEnabled: vi.fn(),
  markOutboxAccepted: vi.fn(),
  markOutboxFailed: vi.fn(),
  markOutboxSubmitting: vi.fn(),
  supabase: { from: vi.fn() },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(async () => mocks.supabase),
  getAuthUser: vi.fn(async () => ({
    user: { id: 'user-1', email: 'sender@example.com' },
    error: null,
  })),
  getAuthProfile: vi.fn(),
}));
vi.mock('@/lib/integrations', () => ({
  createLog: mocks.createLog,
}));
vi.mock('@/lib/integrations/adapters/credentials', () => ({
  decrypt: vi.fn(() => 'provider-api-key'),
}));
vi.mock('@/lib/email/comms-flags', () => ({
  COMMS_FLAGS: {
    killSwitch: 'kill-switch',
    outboxSend: 'outbox-send',
  },
  isCommsFlagEnabled: mocks.isCommsFlagEnabled,
}));
vi.mock('@/lib/email/outbox', () => ({
  enqueueOutbox: mocks.enqueueOutbox,
  markOutboxAccepted: mocks.markOutboxAccepted,
  markOutboxFailed: mocks.markOutboxFailed,
  markOutboxSubmitting: mocks.markOutboxSubmitting,
  outboxAlreadyAccepted: vi.fn(() => false),
  classifyProviderError: vi.fn(() => 'transient'),
  createOutboxAdminClient: vi.fn(() => ({})),
}));

import { sendEmail } from './send-service';

const OUTBOX_ROW = {
  id: 'outbox-1',
  organization_id: 'org-1',
  idempotency_key: 'send-1',
  attempt_count: 0,
  status: 'queued',
};

function queryResult(data: unknown) {
  const chain: Record<string, any> = {};
  for (const method of ['select', 'eq']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(async () => ({ data, error: null }));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return queryResult({
        id: 'profile-1',
        organization_id: 'org-1',
        email: 'sender@example.com',
        full_name: 'Sender',
      });
    }
    if (table === 'organizations') {
      return queryResult({ name: 'Example Org', settings: {} });
    }
    if (table === 'integration_connections') {
      return queryResult({
        id: 'connection-1',
        provider: 'resend',
        api_key_enc: 'encrypted',
        settings: { from_email: 'support@example.com' },
      });
    }
    if (table === 'sent_emails') {
      return {
        insert: vi.fn(async () => ({
          error: { message: 'audit table unavailable' },
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.isCommsFlagEnabled
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  mocks.enqueueOutbox.mockResolvedValue({ row: OUTBOX_ROW, reused: false });
  mocks.markOutboxSubmitting.mockResolvedValue(undefined);
  mocks.markOutboxAccepted.mockResolvedValue(undefined);
  mocks.markOutboxFailed.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendEmail outbox terminal state', () => {
  it('keeps an accepted email successful when post-send audit logging fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'provider-message-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    mocks.createLog.mockRejectedValue(new Error('integration log unavailable'));

    const result = await sendEmail({
      to: 'member@example.com',
      subject: 'Coverage documents',
      body_text: 'Attached are your documents.',
    });

    expect(result).toMatchObject({
      success: true,
      message_id: 'provider-message-1',
      outbox_id: OUTBOX_ROW.id,
    });
    expect(mocks.markOutboxAccepted).toHaveBeenCalledOnce();
    expect(mocks.markOutboxFailed).not.toHaveBeenCalled();
  });

  it('still marks a pre-accept provider exception as failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('provider timeout'));

    const result = await sendEmail({
      to: 'member@example.com',
      subject: 'Coverage documents',
      body_text: 'Attached are your documents.',
    });

    expect(result).toMatchObject({ success: false, error: 'provider timeout' });
    expect(mocks.markOutboxAccepted).not.toHaveBeenCalled();
    expect(mocks.markOutboxFailed).toHaveBeenCalledOnce();
  });
});
