import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest, buildSupabaseClient } from '@/test/helpers';

const mocks = vi.hoisted(() => ({
  requireCrmApiKey: vi.fn(),
  emitMembershipWebhook: vi.fn(),
}));

vi.mock('@/lib/public-api-auth', () => ({
  requireCrmApiKey: mocks.requireCrmApiKey,
}));

vi.mock('@/lib/membership-webhooks', () => ({
  emitMembershipWebhook: mocks.emitMembershipWebhook,
}));

import { POST } from './route';

describe('POST /api/public/v1/memberships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emitMembershipWebhook.mockResolvedValue({
      planned: 0,
      delivered: 0,
      dryRun: true,
    });
  });

  it('rejects a member outside the API key organization before insert', async () => {
    const built = buildSupabaseClient({
      members: { data: null, error: null },
      plans: { data: { id: 'plan-a' }, error: null },
      memberships: {
        data: {
          id: 'membership-1',
          member_id: 'member-from-another-org',
          plan_id: 'plan-a',
        },
        error: null,
      },
    });
    mocks.requireCrmApiKey.mockResolvedValue({
      key: { organization_id: 'org-a' },
      supabase: built.client,
      scopes: ['crm.write'],
    });

    const response = await POST(
      buildRequest('https://crm.example.test/api/public/v1/memberships', {
        method: 'POST',
        body: {
          member_id: 'member-from-another-org',
          plan_id: 'plan-a',
        },
      }),
    );

    expect(response.status).toBe(404);
    expect(built.queryBuilders.memberships.insert).not.toHaveBeenCalled();
    expect(mocks.emitMembershipWebhook).not.toHaveBeenCalled();
  });

  it('rejects a plan outside the API key organization before insert', async () => {
    const built = buildSupabaseClient({
      members: { data: { id: 'member-a' }, error: null },
      plans: { data: null, error: null },
      memberships: {
        data: { id: 'membership-1', member_id: 'member-a', plan_id: 'plan-from-another-org' },
        error: null,
      },
    });
    mocks.requireCrmApiKey.mockResolvedValue({
      key: { organization_id: 'org-a' },
      supabase: built.client,
      scopes: ['crm.write'],
    });

    const response = await POST(
      buildRequest('https://crm.example.test/api/public/v1/memberships', {
        method: 'POST',
        body: {
          member_id: 'member-a',
          plan_id: 'plan-from-another-org',
        },
      }),
    );

    expect(response.status).toBe(404);
    expect(built.queryBuilders.memberships.insert).not.toHaveBeenCalled();
  });

  it('creates the membership after both references match the key organization', async () => {
    const built = buildSupabaseClient({
      members: { data: { id: 'member-a' }, error: null },
      plans: { data: { id: 'plan-a' }, error: null },
      memberships: {
        data: {
          id: 'membership-1',
          member_id: 'member-a',
          plan_id: 'plan-a',
          status: 'pending',
          layer: 'core',
          effective_date: '2026-09-18',
        },
        error: null,
      },
    });
    mocks.requireCrmApiKey.mockResolvedValue({
      key: { organization_id: 'org-a' },
      supabase: built.client,
      scopes: ['crm.write'],
    });

    const response = await POST(
      buildRequest('https://crm.example.test/api/public/v1/memberships', {
        method: 'POST',
        body: {
          member_id: 'member-a',
          plan_id: 'plan-a',
          effective_date: '2026-09-18',
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(built.queryBuilders.memberships.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-a',
        member_id: 'member-a',
        plan_id: 'plan-a',
      }),
    );
    expect(mocks.emitMembershipWebhook).toHaveBeenCalledTimes(1);
  });
});
