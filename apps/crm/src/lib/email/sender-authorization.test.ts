import { describe, expect, it, vi } from 'vitest';
import { resolveAuthorizedSenderAddress } from './sender-authorization';

const PROFILE = {
  id: 'profile-1',
  organization_id: 'org-1',
};

function createClient(options?: {
  allowedDomainIds?: string[] | null;
  sender?: {
    email: string;
    name: string | null;
    domain_id: string | null;
  } | null;
  settingsError?: unknown;
  senderError?: unknown;
}) {
  const settingsQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  const senderQuery: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of ['select', 'eq']) {
    settingsQuery[method] = vi.fn(() => settingsQuery);
    senderQuery[method] = vi.fn(() => senderQuery);
  }

  settingsQuery.maybeSingle = vi.fn().mockResolvedValue({
    data:
      options?.allowedDomainIds === undefined
        ? null
        : { allowed_domain_ids: options.allowedDomainIds },
    error: options?.settingsError ?? null,
  });
  senderQuery.maybeSingle = vi.fn().mockResolvedValue({
    data: options?.sender ?? null,
    error: options?.senderError ?? null,
  });

  const from = vi.fn((table: string) => {
    if (table === 'user_email_settings') return settingsQuery;
    if (table === 'email_sender_addresses') return senderQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from }, from, senderQuery };
}

describe('resolveAuthorizedSenderAddress', () => {
  it('keeps the server default when the client omits from_email', async () => {
    const { client, from } = createClient();

    await expect(resolveAuthorizedSenderAddress(client, PROFILE, undefined)).resolves.toEqual({
      authorized: true,
      sender: null,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('returns the canonical registered sender for an unrestricted profile', async () => {
    const { client, senderQuery } = createClient({
      sender: {
        email: 'support@payitforwardhealth.com',
        name: 'Pay It Forward Health Support',
        domain_id: 'domain-1',
      },
    });

    await expect(
      resolveAuthorizedSenderAddress(client, PROFILE, ' SUPPORT@payitforwardhealth.com ')
    ).resolves.toEqual({
      authorized: true,
      sender: {
        email: 'support@payitforwardhealth.com',
        name: 'Pay It Forward Health Support',
      },
    });
    expect(senderQuery.eq).toHaveBeenCalledWith('email', 'support@payitforwardhealth.com');
    expect(senderQuery.eq).toHaveBeenCalledWith('is_verified', true);
    expect(senderQuery.eq).toHaveBeenCalledWith('email_domains.status', 'verified');
  });

  it('rejects an unregistered sender address', async () => {
    const { client } = createClient({ sender: null });

    await expect(
      resolveAuthorizedSenderAddress(client, PROFILE, 'ceo@payitforwardhealth.com')
    ).resolves.toEqual({ authorized: false, sender: null });
  });

  it('rejects a sender outside the profile domain allowlist', async () => {
    const { client } = createClient({
      allowedDomainIds: ['domain-allowed'],
      sender: {
        email: 'support@payitforwardhealth.com',
        name: 'Support',
        domain_id: 'domain-blocked',
      },
    });

    await expect(
      resolveAuthorizedSenderAddress(client, PROFILE, 'support@payitforwardhealth.com')
    ).resolves.toEqual({ authorized: false, sender: null });
  });

  it('fails closed when sender permissions cannot be loaded', async () => {
    const { client } = createClient({
      senderError: { message: 'database unavailable' },
    });

    await expect(
      resolveAuthorizedSenderAddress(client, PROFILE, 'support@payitforwardhealth.com')
    ).rejects.toThrow('Unable to verify sender address permissions');
  });
});
