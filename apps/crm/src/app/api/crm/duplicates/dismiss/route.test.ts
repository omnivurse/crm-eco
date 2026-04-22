import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const LEFT_ID = '11111111-1111-1111-1111-111111111111';
const RIGHT_ID = '22222222-2222-2222-2222-222222222222';

const mockGetAuthProfile = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  createClient: () => ({
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  }),
}));

import { POST } from './route';

describe('POST /api/crm/duplicates/dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost/api/crm/duplicates/dismiss', {
      method: 'POST',
      body: { left_id: LEFT_ID, right_id: RIGHT_ID },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for agent role', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_agent' }));
    const req = buildRequest('http://localhost/api/crm/duplicates/dismiss', {
      method: 'POST',
      body: { left_id: LEFT_ID, right_id: RIGHT_ID },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when both ids are the same', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    const req = buildRequest('http://localhost/api/crm/duplicates/dismiss', {
      method: 'POST',
      body: { left_id: LEFT_ID, right_id: LEFT_ID },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid UUID', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    const req = buildRequest('http://localhost/api/crm/duplicates/dismiss', {
      method: 'POST',
      body: { left_id: 'not-a-uuid', right_id: RIGHT_ID },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('forwards RPC business-rule failure as 400', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'Records must belong to your organization' },
      error: null,
    });
    const req = buildRequest('http://localhost/api/crm/duplicates/dismiss', {
      method: 'POST',
      body: { left_id: LEFT_ID, right_id: RIGHT_ID, reason: 'twins' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns RPC payload on happy path and passes reason through', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_manager' }));
    mockRpc.mockResolvedValue({
      data: { success: true, left_id: LEFT_ID, right_id: RIGHT_ID },
      error: null,
    });
    const req = buildRequest('http://localhost/api/crm/duplicates/dismiss', {
      method: 'POST',
      body: { left_id: LEFT_ID, right_id: RIGHT_ID, reason: 'twins' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'dismiss_duplicate_pair',
      expect.objectContaining({
        p_a_id: LEFT_ID,
        p_b_id: RIGHT_ID,
        p_reason: 'twins',
      }),
    );
  });
});
