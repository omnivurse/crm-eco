import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const mockGetAuthProfile = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  createClient: () => ({
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  }),
}));

import { POST } from './route';

describe('POST /api/crm/duplicates/bulk-merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost/api/crm/duplicates/bulk-merge', {
      method: 'POST',
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for manager role (bulk-merge is admin-only)', async () => {
    mockGetAuthProfile.mockResolvedValue(
      buildProfile({ crm_role: 'crm_manager', organization_id: ORG_ID }),
    );
    const req = buildRequest('http://localhost/api/crm/duplicates/bulk-merge', {
      method: 'POST',
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 when max_per_rule is out of range', async () => {
    mockGetAuthProfile.mockResolvedValue(
      buildProfile({ crm_role: 'crm_admin', organization_id: ORG_ID }),
    );
    const req = buildRequest('http://localhost/api/crm/duplicates/bulk-merge', {
      method: 'POST',
      body: { max_per_rule: 10000 },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('invokes the RPC with the caller org and default cap', async () => {
    mockGetAuthProfile.mockResolvedValue(
      buildProfile({ crm_role: 'crm_admin', organization_id: ORG_ID }),
    );
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        rule1: 2, rule2: 3, rule3: 1, rule4: 0, rule5: 0,
        errors: 0, total: 6,
      },
      error: null,
    });
    const req = buildRequest('http://localhost/api/crm/duplicates/bulk-merge', {
      method: 'POST',
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(6);
    expect(mockRpc).toHaveBeenCalledWith(
      'bulk_auto_merge_duplicates',
      { p_org_id: ORG_ID, p_max_per_rule: 1000 },
    );
  });

  it('surfaces RPC business failures as 400', async () => {
    mockGetAuthProfile.mockResolvedValue(
      buildProfile({ crm_role: 'crm_admin', organization_id: ORG_ID }),
    );
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'Not authenticated' },
      error: null,
    });
    const req = buildRequest('http://localhost/api/crm/duplicates/bulk-merge', {
      method: 'POST',
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
