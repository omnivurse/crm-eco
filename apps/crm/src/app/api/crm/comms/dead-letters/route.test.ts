import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildQueryBuilder, buildRequest } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { GET, PATCH } from './route';

const OPEN_ROW = {
  id: 'dcbd795d-0b82-41f9-a091-9467d0a41bf7',
  source: 'email_intake',
  error_category: 'unroutable_recipient',
  error: 'No verified email_domains match',
  created_at: '2026-09-04T16:18:01.060Z',
  organization_id: null,
  org_id: null,
  resolved_at: null,
};

describe('GET /api/crm/comms/dead-letters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns 403 for an agent', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_agent' }));
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('lists unresolved rows without asking for payload', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    const builder = buildQueryBuilder({ data: [OPEN_ROW], error: null });
    mockCreateClient.mockReturnValue({ from: vi.fn(() => builder) });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(OPEN_ROW.id);
    expect(builder.select).toHaveBeenCalledWith(
      'id, source, error_category, error, created_at, organization_id, org_id, resolved_at',
    );
    expect(String(builder.select.mock.calls[0][0])).not.toContain('payload');
    expect(builder.is).toHaveBeenCalledWith('resolved_at', null);
  });
});

describe('PATCH /api/crm/comms/dead-letters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for an agent (no write)', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_agent' }));
    const res = await PATCH(
      buildRequest('http://localhost/api/crm/comms/dead-letters', {
        method: 'PATCH',
        body: { id: OPEN_ROW.id, resolved: true },
      }),
    );
    expect(res.status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid id', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    const res = await PATCH(
      buildRequest('http://localhost/api/crm/comms/dead-letters', {
        method: 'PATCH',
        body: { id: 'not-a-uuid', resolved: true },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('marks one open row reviewed and pins resolved_by to the caller', async () => {
    const profile = buildProfile({ crm_role: 'crm_admin', user_id: 'user-admin-1' });
    mockGetAuthProfile.mockResolvedValue(profile);
    const builder = buildQueryBuilder({
      data: { id: OPEN_ROW.id, resolved_at: '2026-09-16T02:00:00.000Z' },
      error: null,
    });
    mockCreateClient.mockReturnValue({ from: vi.fn(() => builder) });

    const res = await PATCH(
      buildRequest('http://localhost/api/crm/comms/dead-letters', {
        method: 'PATCH',
        body: { id: OPEN_ROW.id, resolved: true },
      }),
    );
    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ resolved_by: 'user-admin-1' }),
    );
    expect(builder.eq).toHaveBeenCalledWith('id', OPEN_ROW.id);
    expect(builder.is).toHaveBeenCalledWith('resolved_at', null);
  });
});
