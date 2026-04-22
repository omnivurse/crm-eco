import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

const mockGetAuthProfile = vi.fn();
const mockSupabaseQuery = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  createClient: () => ({
    from: (table: string) => mockSupabaseQuery(table),
  }),
}));

import { GET } from './route';

function chainableQuery(result: {
  data: unknown;
  error: unknown;
  count?: number | null;
}) {
  // Supabase builder: .from().select().eq().eq().or().order().order().range()
  // is a promise at the end. We replicate that shape with a thenable chain.
  const chain: Record<string, any> = {};
  const methods = ['select', 'eq', 'order', 'range', 'or'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

describe('GET /api/crm/duplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost/api/crm/duplicates');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for agent role (admin/manager only)', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_agent' }));
    const req = buildRequest('http://localhost/api/crm/duplicates');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('rejects invalid confidence values', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    const req = buildRequest('http://localhost/api/crm/duplicates?confidence=extreme');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('rejects invalid page_size (> 50)', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    const req = buildRequest('http://localhost/api/crm/duplicates?page_size=500');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns the view rows sorted by confidence (high → low) on happy path', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_manager' }));

    const sample = [
      { left_id: 'a', right_id: 'b', confidence: 'low',    left_updated_at: '2026-01-01T00:00:00Z' },
      { left_id: 'c', right_id: 'd', confidence: 'high',   left_updated_at: '2026-01-01T00:00:00Z' },
      { left_id: 'e', right_id: 'f', confidence: 'medium', left_updated_at: '2026-01-01T00:00:00Z' },
    ];
    mockSupabaseQuery.mockReturnValueOnce(
      chainableQuery({ data: sample, error: null, count: 3 }),
    );

    const req = buildRequest('http://localhost/api/crm/duplicates');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.total).toBe(3);
    expect(json.pairs.map((p: any) => p.confidence)).toEqual(['high', 'medium', 'low']);
  });

  it('surfaces Supabase errors as 500', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_admin' }));
    mockSupabaseQuery.mockReturnValueOnce(
      chainableQuery({ data: null, error: { message: 'boom' } }),
    );
    const req = buildRequest('http://localhost/api/crm/duplicates');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
