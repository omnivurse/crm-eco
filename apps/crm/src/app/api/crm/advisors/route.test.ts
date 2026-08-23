import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile, buildSupabaseClient } from '@/test/helpers';

const ORG_A = '00000000-0000-0000-0000-000000000001';
const ORG_B = '00000000-0000-0000-0000-00000000000b';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { GET } from './route';

const ROWS = [
  { id: 'adv-1', first_name: 'Wen', last_name: 'Producer', full_name: 'Wen Producer', agency_name: 'Walk Agency', state: 'TX', is_active: true },
  { id: 'adv-2', first_name: 'Pat', last_name: 'Producer', full_name: null, agency_name: null, state: null, is_active: true },
];

function mockClient(result: { data?: unknown; error?: unknown; count?: number | null } = { data: ROWS, error: null, count: 2 }) {
  return buildSupabaseClient({ advisors: result, crm_advisors: { data: [], error: null } });
}

describe('GET /api/crm/advisors (producer picker source = public.advisors)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_A }));
  });

  it('401 when unauthenticated — no table is touched', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest('/api/crm/advisors?search=Wen'));
    expect(res.status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('reads public.advisors pinned to the caller org, live rows only, and returns {id,name}', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest('/api/crm/advisors?is_active=true&limit=40&search=Wen'));
    expect(res.status).toBe(200);
    expect(client.from).toHaveBeenCalledWith('advisors');
    expect(client.from).not.toHaveBeenCalledWith('crm_advisors');
    const qb = queryBuilders.advisors;
    expect(qb.eq).toHaveBeenCalledWith('organization_id', ORG_A);
    expect(qb.is).toHaveBeenCalledWith('deleted_at', null);
    expect(qb.eq).toHaveBeenCalledWith('is_active', true);
    expect(qb.or).toHaveBeenCalledWith(
      'full_name.ilike.%Wen%,first_name.ilike.%Wen%,last_name.ilike.%Wen%,agency_name.ilike.%Wen%',
    );
    expect(qb.range).toHaveBeenCalledWith(0, 39);
    // Only names leave the route (no email / phone / license columns).
    const selectArg = String((qb.select as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(selectArg).not.toMatch(/email|phone|license|npn/);
    const body = (await res.json()) as { data: Array<Record<string, unknown>>; total: number };
    expect(body.total).toBe(2);
    expect(body.data.map((r) => [r.id, r.name, r.advisor_name])).toEqual([
      ['adv-1', 'Wen Producer', 'Wen Producer'],
      ['adv-2', 'Pat Producer', 'Pat Producer'],
    ]);
  });

  it('two tenants: the org predicate follows the caller profile (org B never asks for org A rows)', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_B }));
    const { client, queryBuilders } = mockClient({ data: [], error: null, count: 0 });
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest('/api/crm/advisors?search=Wen'));
    expect(res.status).toBe(200);
    expect(queryBuilders.advisors.eq).toHaveBeenCalledWith('organization_id', ORG_B);
    expect(queryBuilders.advisors.eq).not.toHaveBeenCalledWith('organization_id', ORG_A);
    expect(await res.json()).toEqual({ data: [], total: 0 });
  });

  it('escapes a hostile search and never leaks the DB error text', async () => {
    const { client, queryBuilders } = mockClient({ data: null, error: { message: 'relation secret' }, count: null });
    mockCreateClient.mockResolvedValue(client);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(buildRequest('/api/crm/advisors?search=' + encodeURIComponent('a%,b)')));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('relation secret');
    const orArg = String((queryBuilders.advisors.or as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(orArg).toContain('a\\%\\,b\\)');
    spy.mockRestore();
  });

  it('clamps limit/offset', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    await GET(buildRequest('/api/crm/advisors?limit=9999&offset=-5'));
    expect(queryBuilders.advisors.range).toHaveBeenCalledWith(0, 499);
  });
});
