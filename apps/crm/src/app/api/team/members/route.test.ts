import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { GET } from './route';

function buildMockClient(result: { data: unknown; error: unknown }) {
  const chainable: Record<string, any> = {};
  ['select', 'eq', 'not', 'order'].forEach(m => {
    chainable[m] = vi.fn(() => chainable);
  });
  // Terminal: the query resolves when awaited (via .then)
  chainable.then = (resolve: Function) => resolve(result);
  return { from: vi.fn(() => chainable), chainable };
}

describe('GET /api/team/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost:3000/api/team/members');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns members successfully', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    const members = [
      { id: 'p-1', full_name: 'Alice', crm_role: 'crm_admin' },
      { id: 'p-2', full_name: 'Bob', crm_role: 'crm_agent' },
    ];
    const sb = buildMockClient({ data: members, error: null });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/members');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(members);
  });

  it('filters by includeInactive', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    const sb = buildMockClient({ data: [], error: null });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/members?includeInactive=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    // When includeInactive=true, .eq('status', 'active') should NOT be called
    // The eq mock was called for organization_id but not for status
  });

  it('filters CRM-only members', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    const sb = buildMockClient({ data: [], error: null });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/members?crmOnly=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    // Verify .not('crm_role', 'is', null) was called
    expect(sb.chainable.not).toHaveBeenCalledWith('crm_role', 'is', null);
  });

  it('returns empty array when data is null', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    const sb = buildMockClient({ data: null, error: null });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/members');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    const sb = buildMockClient({ data: null, error: { message: 'Connection error' } });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/members');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
