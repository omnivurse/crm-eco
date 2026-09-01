import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthUser = vi.fn();
const mockCreateServerClient = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthUser: () => mockGetAuthUser(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

import { POST } from './route';

describe('POST /api/team/invite/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({
      user: { id: 'user-1', email: 'advisor@example.com' },
    });
  });

  it('grants crm_agent access when accepting an advisor invitation', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const invitationSingle = vi.fn().mockResolvedValue({
      data: { role: 'advisor' },
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        if (table === 'team_invitations') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ single: invitationSingle })),
            })),
          };
        }
        if (table === 'profiles') {
          return { update };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockCreateServerClient.mockReturnValue(serviceClient);
    mockCreateClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: 'profile-1', error: null }),
    });

    const request = buildRequest('http://localhost:3000/api/team/invite/accept', {
      method: 'POST',
      body: { token: 'invite-token', fullName: 'New Advisor' },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, profileId: 'profile-1' });
    expect(update).toHaveBeenCalledWith({ crm_role: 'crm_agent' });
    expect(updateEq).toHaveBeenCalledWith('id', 'profile-1');
  });
});
