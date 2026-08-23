/**
 * LS-5 — status-values endpoint: never browser-cached (the client invalidates
 * its own cache after bulk status changes), and when the request carries the
 * list's row-set params the lanes are re-counted through the ONE shared
 * predicate builder (`applyRecordListQuery`) with the status filter stripped.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

const ORG_A = '00000000-0000-0000-0000-000000000001';
const MODULE_ID = '00000000-0000-0000-0000-00000000c001';
const USER_ID = 'user-1';
const PROFILE_ID = 'prof-1';

type Call = { table: string; method: string; args: unknown[] };

const mockCreateClient = vi.fn();
const mockGetAuthUser = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthUser: () => mockGetAuthUser(),
  getAuthProfile: () => mockGetAuthProfile(),
}));
vi.mock('@/lib/tenant', () => ({
  getActiveTenant: async () => null,
}));

import { GET } from './route';

const RPC_ROWS = [
  { status: 'Active', count_id: 10 },
  { status: 'Pending', count_id: 3 },
  { status: 'Approved Pending', count_id: 2 },
  { status: 'Cancelled', count_id: 5 },
];

type ResultFor = (chain: Call[]) => { data?: unknown; error?: unknown; count?: number | null };

function makeRecordingClient(results: Record<string, ResultFor>, log: Call[]) {
  const from = vi.fn((table: string) => {
    const chain: Call[] = [];
    const resolve = () => (results[table] ?? (() => ({ data: null, error: null })))(chain);
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_t, prop) {
        if (prop === 'then') {
          return (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
            Promise.resolve(resolve()).then(onOk, onErr);
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            const call = { table, method: String(prop), args: [] };
            chain.push(call);
            log.push(call);
            return Promise.resolve(resolve());
          };
        }
        if (typeof prop !== 'string') return undefined;
        return (...args: unknown[]) => {
          const call = { table, method: prop, args };
          chain.push(call);
          log.push(call);
          return proxy;
        };
      },
    };
    const proxy = new Proxy({}, handler);
    return proxy;
  });
  return {
    from,
    rpc: vi.fn(async (fn: string) => ({ data: fn === 'execute_report_aggregation' ? { rows: RPC_ROWS } : null, error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: USER_ID } }, error: null })) },
  };
}

function tableResults(): Record<string, ResultFor> {
  return {
    crm_modules: () => ({ data: { id: MODULE_ID, org_id: ORG_A }, error: null }),
    profiles: () => ({ data: { id: PROFILE_ID, user_id: USER_ID, organization_id: ORG_A }, error: null }),
    crm_fields: () => ({ data: [{ id: 'f1', key: 'first_name', label: 'First', module_id: MODULE_ID }], error: null }),
    // Every lane re-count answers 1 so a narrowed lane is visibly different from the RPC sum.
    crm_records: () => ({ data: null, count: 1, error: null }),
  };
}

function recordsQueries(log: Call[]): Call[][] {
  const groups: Call[][] = [];
  let current: Call[] | null = null;
  for (const c of log) {
    if (c.table !== 'crm_records') continue;
    if (c.method === 'select') {
      current = [];
      groups.push(current);
    }
    current?.push(c);
  }
  return groups;
}

describe('GET /api/crm/records/status-values', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ user: { id: USER_ID }, error: null });
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ id: PROFILE_ID, organization_id: ORG_A }), role: 'admin' });
  });

  it('answers Cache-Control: no-store and RPC-summed lanes for an un-narrowed org-wide role', async () => {
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), log));
    const res = await GET(buildRequest('/api/crm/records/status-values?module_key=contacts'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.narrowed).toBe(false);
    expect(body.values.map((v: { value: string; count: number }) => [v.value, v.count])).toEqual([
      ['Active', 10], ['Pending', 3], ['Approved Pending', 2], ['Cancelled', 5],
    ]);
    const pending = body.lanes.find((l: { lane: string }) => l.lane === 'pending');
    expect(pending.count).toBe(5);
    // No per-lane crm_records count for an org-wide role without narrowing.
    expect(recordsQueries(log)).toHaveLength(0);
  });

  it('narrowed (search + scope + a lane filter): lanes re-counted through the shared predicate, status filter stripped', async () => {
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), log));
    const params = new URLSearchParams({
      module_key: 'contacts',
      search: 'wen',
      scope: 'mine',
      filters: JSON.stringify([
        { field: 'contact_status', operator: 'in', value: ['Pending', 'Approved Pending'] },
        { field: 'city', operator: 'equals', value: 'Austin' },
      ]),
    });
    const res = await GET(buildRequest(`/api/crm/records/status-values?${params}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.narrowed).toBe(true);
    // Values stay module-wide (the chips need every spelling for their in-filter)…
    expect(body.values).toHaveLength(4);
    // …but every non-empty lane was re-counted (answer: 1 each).
    for (const lane of ['active', 'pending', 'cancelled']) {
      expect(body.lanes.find((l: { lane: string }) => l.lane === lane).count, lane).toBe(1);
    }
    const queries = recordsQueries(log);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    for (const q of queries) {
      const calls = q.map((c) => [c.method, c.args]);
      expect(calls[0]).toEqual(['select', ['id', { count: 'exact', head: true }]]);
      expect(calls).toContainEqual(['eq', ['module_id', MODULE_ID]]);
      expect(calls).toContainEqual(['eq', ['org_id', ORG_A]]);
      expect(calls).toContainEqual(['is', ['deleted_at', null]]);
      // scope=mine → owner_id = the viewer's profile id.
      expect(calls).toContainEqual(['eq', ['owner_id', PROFILE_ID]]);
      // The non-status filter is applied…
      expect(calls.some(([m, a]) => m === 'eq' && (a as unknown[])[0] === 'data->>city')).toBe(true);
      // …the search is applied…
      expect(calls.some(([m, a]) => m === 'or' && String((a as unknown[])[0]).includes('first_name.ilike'))).toBe(true);
      // …and the ONLY status predicate is the lane's own `in` (the URL's status filter was stripped).
      const statusIns = calls.filter(([m, a]) => m === 'in' && (a as unknown[])[0] === 'status');
      expect(statusIns).toHaveLength(1);
    }
    const pendingQuery = queries.find((q) =>
      q.some((c) => c.method === 'in' && JSON.stringify(c.args[1]) === JSON.stringify(['Pending', 'Approved Pending'])),
    );
    expect(pendingQuery).toBeDefined();
  });

  it('anon → 401; missing module_key → 400', async () => {
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), []));
    mockGetAuthProfile.mockResolvedValueOnce(null);
    expect((await GET(buildRequest('/api/crm/records/status-values?module_key=contacts'))).status).toBe(401);
    expect((await GET(buildRequest('/api/crm/records/status-values'))).status).toBe(400);
  });
});
