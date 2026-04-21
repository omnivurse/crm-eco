import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const KEEPER_ID = '11111111-1111-1111-1111-111111111111';
const DUP_ID = '22222222-2222-2222-2222-222222222222';

const mockGetAuthProfile = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
}));

// Stub the service-role Supabase client with the bare minimum API used by
// the route (just `.rpc`). Keeping this narrow avoids leaking mocks into
// unrelated tests that also import from `@supabase/supabase-js`.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  }),
}));

import { POST } from './route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/crm/records/[id]/merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest(`http://localhost/api/crm/records/${KEEPER_ID}/merge`, {
      method: 'POST',
      body: { duplicate_id: DUP_ID },
    });
    const res = await POST(req, makeParams(KEEPER_ID));
    expect(res.status).toBe(401);
  });

  it('returns 403 for agent role (merges are admin/manager only)', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_agent' }));
    const req = buildRequest(`http://localhost/api/crm/records/${KEEPER_ID}/merge`, {
      method: 'POST',
      body: { duplicate_id: DUP_ID },
    });
    const res = await POST(req, makeParams(KEEPER_ID));
    expect(res.status).toBe(403);
  });

  it('returns 400 when the body is missing duplicate_id', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    const req = buildRequest(`http://localhost/api/crm/records/${KEEPER_ID}/merge`, {
      method: 'POST',
      body: {},
    });
    const res = await POST(req, makeParams(KEEPER_ID));
    expect(res.status).toBe(400);
  });

  it('refuses to merge a record into itself', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    const req = buildRequest(`http://localhost/api/crm/records/${KEEPER_ID}/merge`, {
      method: 'POST',
      body: { duplicate_id: KEEPER_ID },
    });
    const res = await POST(req, makeParams(KEEPER_ID));
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propagates a business-rule failure from the RPC as 400', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'Records belong to different modules' },
      error: null,
    });

    const req = buildRequest(`http://localhost/api/crm/records/${KEEPER_ID}/merge`, {
      method: 'POST',
      body: { duplicate_id: DUP_ID },
    });
    const res = await POST(req, makeParams(KEEPER_ID));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/different modules/);
  });

  it('returns the RPC success payload on a happy-path merge', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_manager' }));
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        kept_id: KEEPER_ID,
        deleted_id: DUP_ID,
        moved_notes: 4,
        moved_tasks: 1,
        moved_attachments: 0,
        moved_links: 2,
      },
      error: null,
    });

    const req = buildRequest(`http://localhost/api/crm/records/${KEEPER_ID}/merge`, {
      method: 'POST',
      body: {
        duplicate_id: DUP_ID,
        merged_status: 'Active',
      },
    });
    const res = await POST(req, makeParams(KEEPER_ID));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.moved_notes).toBe(4);

    // Verifies the route forwards all merge-override args to the RPC.
    expect(mockRpc).toHaveBeenCalledWith(
      'merge_crm_records',
      expect.objectContaining({
        p_keeper_id: KEEPER_ID,
        p_duplicate_id: DUP_ID,
        p_merged_status: 'Active',
      }),
    );
  });

  it('surfaces a raw RPC error as 500', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'connection reset' },
    });

    const req = buildRequest(`http://localhost/api/crm/records/${KEEPER_ID}/merge`, {
      method: 'POST',
      body: { duplicate_id: DUP_ID },
    });
    const res = await POST(req, makeParams(KEEPER_ID));
    expect(res.status).toBe(500);
  });
});
