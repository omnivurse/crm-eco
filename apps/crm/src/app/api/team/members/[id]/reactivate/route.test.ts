import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest, buildSupabaseClient } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { POST } from './route';

const request = buildRequest(
  'http://localhost:3000/api/team/members/target-profile/reactivate',
  { method: 'POST' },
);

function profile(role: string, crmRole: string | null = null) {
  return {
    id: 'actor-profile',
    organization_id: 'org-1',
    role,
    crm_role: crmRole,
  };
}

function target(role: string) {
  return {
    id: 'target-profile',
    organization_id: 'org-1',
    role,
    is_active: false,
  };
}

async function reactivate(targetRole: string) {
  const { client, queryBuilders } = buildSupabaseClient({
    profiles: { data: target(targetRole), error: null },
  });
  mockCreateClient.mockResolvedValue(client);

  const response = await POST(request, {
    params: Promise.resolve({ id: 'target-profile' }),
  });

  return { response, profiles: queryBuilders.profiles };
}

describe('POST /api/team/members/[id]/reactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents a CRM-only admin from reactivating a super admin', async () => {
    mockGetAuthProfile.mockResolvedValue(profile('staff', 'crm_admin'));

    const { response, profiles } = await reactivate('super_admin');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot reactivate user with equal or higher role',
    });
    expect(profiles.update).not.toHaveBeenCalled();
  });

  it('prevents an organization admin from reactivating an equal-role admin', async () => {
    mockGetAuthProfile.mockResolvedValue(profile('admin'));

    const { response, profiles } = await reactivate('admin');

    expect(response.status).toBe(403);
    expect(profiles.update).not.toHaveBeenCalled();
  });

  it('allows an organization admin to reactivate a lower-role member', async () => {
    mockGetAuthProfile.mockResolvedValue(profile('admin'));

    const { response, profiles } = await reactivate('staff');

    expect(response.status).toBe(200);
    expect(profiles.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: true }),
    );
  });

  it('allows the organization owner to reactivate a super admin', async () => {
    mockGetAuthProfile.mockResolvedValue(profile('owner'));

    const { response, profiles } = await reactivate('super_admin');

    expect(response.status).toBe(200);
    expect(profiles.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: true }),
    );
  });
});
