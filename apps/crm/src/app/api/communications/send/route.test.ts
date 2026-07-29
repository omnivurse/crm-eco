import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();
const mockGetAuthUser = vi.fn();
const mockResolveAuthorizedSenderAddress = vi.fn();
const mockSendEmail = vi.fn();
const mockSendSms = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
  getAuthUser: () => mockGetAuthUser(),
}));

vi.mock('@/lib/email/sender-authorization', () => ({
  resolveAuthorizedSenderAddress: (...args: unknown[]) =>
    mockResolveAuthorizedSenderAddress(...args),
}));

vi.mock('@/lib/email/send-service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}));

import { POST } from './route';

function createRateLimitClient(count = 0) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.gte = vi.fn().mockResolvedValue({ count, error: null });

  return { from: vi.fn(() => query) };
}

function buildEmailRequest(fromEmail: string) {
  return buildRequest('http://localhost:3000/api/communications/send', {
    method: 'POST',
    body: {
      channel: 'email',
      to: 'member@example.com',
      subject: 'Coverage update',
      body_html: '<p>Update</p>',
      from_email: fromEmail,
      from_name: 'Client-controlled name',
    },
  });
}

describe('POST /api/communications/send sender authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({
      user: { id: 'auth-user-1' },
      error: null,
    });
    mockGetAuthProfile.mockResolvedValue(
      buildProfile({
        id: 'profile-1',
        organization_id: '00000000-0000-0000-0000-000000000001',
      })
    );
    mockCreateClient.mockResolvedValue(createRateLimitClient());
  });

  it('rejects an unregistered client-supplied From address before sending', async () => {
    mockResolveAuthorizedSenderAddress.mockResolvedValue({
      authorized: false,
      sender: null,
    });

    const response = await POST(buildEmailRequest('ceo@payitforwardhealth.com'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Sender address is not authorized for this user',
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('uses the registry email and name instead of client-controlled values', async () => {
    mockResolveAuthorizedSenderAddress.mockResolvedValue({
      authorized: true,
      sender: {
        email: 'support@payitforwardhealth.com',
        name: 'Pay It Forward Health Support',
      },
    });
    mockSendEmail.mockResolvedValue({
      success: true,
      message_id: 'email-1',
      provider: 'resend',
    });

    const response = await POST(buildEmailRequest('support@payitforwardhealth.com'));

    expect(response.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from_email: 'support@payitforwardhealth.com',
        from_name: 'Pay It Forward Health Support',
      })
    );
  });
});
