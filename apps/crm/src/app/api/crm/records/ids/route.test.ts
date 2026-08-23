/**
 * LS-1 — "Select all N" honours the same predicate as the list.
 *
 * The ids route and the list page must build the SAME crm_records predicate
 * from the SAME list URL. We spy on the PostgREST builder: every chained call
 * is recorded, and the filter chain the route produces is compared with the
 * one `getRecords` produces when driven exactly like page.tsx drives it
 * (resolver → getRecords). Plus tenant isolation: anon → 401, a module from
 * another org → 404 with no crm_records query, org_id always in the chain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

const ORG_A = '00000000-0000-0000-0000-000000000001';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const MODULE_ID = '00000000-0000-0000-0000-00000000c001';
const USER_ID = 'user-1';
const PROFILE_ID = 'prof-1';
const VIEW_DEFAULT = 'view-default';
const VIEW_HABIT = 'view-habit';
const VIEW_URL = 'view-url';
const TERRITORY = 'ter-1';

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
import { getRecords, getViewsForModule, getDefaultView, getFieldsForModule } from '@/lib/crm/queries';
import { loadListQueryState, readListUrlQueryState } from '@/lib/crm/list-query-resolve';

const PROFILE_ROW = {
  id: PROFILE_ID,
  user_id: USER_ID,
  organization_id: ORG_A,
  advisor_id: 'adv-1',
  ui_preferences: { habits: { version: 1, preferred_views: { contacts: VIEW_HABIT } } },
};

const VIEWS = [
  { id: VIEW_DEFAULT, module_id: MODULE_ID, name: 'All', is_default: true, columns: [], filters: [{ field: 'contact_status', operator: 'in', value: ['Active'] }], sort: [{ field: 'title', direction: 'asc' }] },
  { id: VIEW_HABIT, module_id: MODULE_ID, name: 'Habit', is_default: false, columns: [], filters: [{ field: 'city', operator: 'equals', value: 'Austin' }], sort: [] },
  { id: VIEW_URL, module_id: MODULE_ID, name: 'Url', is_default: false, columns: [], filters: [{ field: 'product', operator: 'contains', value: 'Bronze' }, { field: 'created_at', operator: 'last_n_days', value: 30 }], sort: [{ field: 'created_at', direction: 'desc' }] },
];

const FIELDS = [
  { id: 'f1', key: 'first_name', label: 'First', module_id: MODULE_ID },
  { id: 'f2', key: 'email', label: 'Email', module_id: MODULE_ID },
  { id: 'f3', key: 'contact_status', label: 'Status', module_id: MODULE_ID },
];

type ResultFor = (chain: Call[]) => { data?: unknown; error?: unknown; count?: number | null };

/**
 * A Supabase client whose builders record every chained call into `log`
 * (tagged by table) and resolve with a per-table result. `single` /
 * `maybeSingle` / `await` are all terminals that receive the chain so far so
 * one table can answer differently per query shape (profiles by id vs in()).
 */
function makeRecordingClient(results: Record<string, ResultFor>, log: Call[], rpc?: (fn: string, args: unknown) => unknown) {
  const from = vi.fn((table: string) => {
    const chain: Call[] = [];
    const resolve = () => (results[table] ?? (() => ({ data: null, error: null })))(chain);
    const builder: Record<string, unknown> = {};
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
    const proxy = new Proxy(builder, handler);
    return proxy;
  });
  return {
    from,
    rpc: vi.fn(async (fn: string, args: unknown) => ({ data: rpc ? rpc(fn, args) : null, error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: USER_ID } }, error: null })) },
  };
}

function tableResults(opts?: { moduleOrg?: string; records?: { rows: number; count: number } }): Record<string, ResultFor> {
  const rows = opts?.records?.rows ?? 2;
  const count = opts?.records?.count ?? rows;
  return {
    crm_modules: () => ({ data: { id: MODULE_ID, org_id: opts?.moduleOrg ?? ORG_A }, error: null }),
    // profiles: `.eq('user_id').single()` → the viewer; `.in('advisor_id', …)` → downline profile rows.
    profiles: (chain) =>
      chain.some((c) => c.method === 'in')
        ? { data: [{ id: PROFILE_ID }, { id: 'prof-2' }], error: null }
        : { data: PROFILE_ROW, error: null },
    crm_views: (chain) =>
      chain.some((c) => c.method === 'single')
        ? { data: VIEWS.find((v) => v.is_default) ?? null, error: null }
        : { data: VIEWS, error: null },
    crm_fields: () => ({ data: FIELDS, error: null }),
    crm_records: () => ({
      data: Array.from({ length: rows }, (_, i) => ({ id: `rec-${i}`, status: 'Pending', data: {} })),
      count,
      error: null,
    }),
    crm_contact_group_members: () => ({ data: [], error: null }),
  };
}

/** The crm_records filter chain between `.eq('module_id')` and the first `.order()` — the predicate. */
function predicateOf(log: Call[]): Array<[string, unknown[]]> {
  const calls = log.filter((c) => c.table === 'crm_records');
  const start = calls.findIndex((c) => c.method === 'eq' && c.args[0] === 'module_id');
  const end = calls.findIndex((c) => c.method === 'order');
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return calls.slice(start + 1, end).map((c) => [c.method, c.args]);
}

function recordsCalls(log: Call[]) {
  return log.filter((c) => c.table === 'crm_records');
}

/**
 * Drive `getRecords` exactly the way app/crm/modules/[moduleKey]/page.tsx does:
 * resolver (views + habit view + URL) → getRecords with the module's field
 * keys as search keys.
 */
async function pageEquivalent(listUrl: URLSearchParams) {
  const [listState, fields] = await Promise.all([
    loadListQueryState({
      moduleKey: 'contacts',
      loadViews: () => getViewsForModule(MODULE_ID),
      loadDefaultView: () => getDefaultView(MODULE_ID),
      uiPreferences: PROFILE_ROW.ui_preferences,
      url: readListUrlQueryState(listUrl),
    }),
    getFieldsForModule(MODULE_ID),
  ]);
  return getRecords({
    moduleId: MODULE_ID,
    orgId: ORG_A,
    moduleKey: 'contacts',
    page: 1,
    pageSize: 25,
    search: listState.search,
    searchDataJsonKeys: fields.map((f) => f.key),
    filters: listState.filters,
    sort: listState.sort,
    scope: listState.scope,
    territoryId: listState.territoryId,
  });
}

const pendingLane = [{ field: 'contact_status', operator: 'in', value: ['Pending', 'Pending Start'] }];

/** List URLs exactly as page.tsx `buildListQuery` writes them. */
const FIXTURES: Record<string, URLSearchParams> = {
  'lane chip + scope mine + territory + search': new URLSearchParams({
    page: '2',
    page_size: '25',
    filters: JSON.stringify(pendingLane),
    scope: 'mine',
    territory: TERRITORY,
    search: 'wen walker',
    sortField: 'created_at',
    sortDirection: 'desc',
  }),
  'saved view from URL (view filters + last_n_days) + downline scope': new URLSearchParams({
    view: VIEW_URL,
    scope: 'downline',
  }),
  'bare module URL (habit-preferred view applies)': new URLSearchParams({ page: '1', page_size: '50', viewMode: 'table' }),
  'empty filters param falls back to the default view filters': new URLSearchParams({ filters: '[]', scope: 'all' }),
};

describe('GET /api/crm/records/ids — same predicate as the list page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ user: { id: USER_ID }, error: null });
    mockGetAuthProfile.mockResolvedValue(buildProfile({ id: PROFILE_ID, organization_id: ORG_A }));
  });

  for (const [name, listUrl] of Object.entries(FIXTURES)) {
    it(`builds the identical crm_records predicate for: ${name}`, async () => {
      const rpc = (fn: string) => (fn === 'get_advisor_downline_ids' ? ['adv-2', 'adv-3'] : null);

      const routeLog: Call[] = [];
      mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), routeLog, rpc));
      const params = new URLSearchParams(listUrl);
      params.set('module_key', 'contacts');
      const res = await GET(buildRequest(`/api/crm/records/ids?${params.toString()}`));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ids: ['rec-0', 'rec-1'], total: 2, capped: false });

      const pageLog: Call[] = [];
      mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), pageLog, rpc));
      const page = await pageEquivalent(listUrl);
      expect(page.total).toBe(2);

      const routePredicate = predicateOf(routeLog);
      const pagePredicate = predicateOf(pageLog);
      expect(routePredicate.length).toBeGreaterThan(1);
      expect(routePredicate).toEqual(pagePredicate);

      // Both start from the module and the org; trash is always excluded.
      expect(routePredicate[0]).toEqual(['eq', ['org_id', ORG_A]]);
      expect(routePredicate[1]).toEqual(['is', ['deleted_at', null]]);

      // Only the select list and the tail differ: ids-only + exact count vs rows.
      const routeSelect = recordsCalls(routeLog).find((c) => c.method === 'select');
      const pageSelect = recordsCalls(pageLog).find((c) => c.method === 'select');
      expect(routeSelect?.args).toEqual(['id', { count: 'exact' }]);
      expect(pageSelect?.args).toEqual(['*', { count: 'exact' }]);
    });
  }

  it('lane chip fixture: the predicate really carries the lane, scope, territory and search', async () => {
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), log));
    const params = new URLSearchParams(FIXTURES['lane chip + scope mine + territory + search']);
    params.set('module_key', 'contacts');
    await GET(buildRequest(`/api/crm/records/ids?${params.toString()}`));
    const predicate = predicateOf(log);
    expect(predicate).toContainEqual(['eq', ['territory_id', TERRITORY]]);
    expect(predicate).toContainEqual(['eq', ['owner_id', PROFILE_ID]]);
    // contact_status aliases to the real `status` column (report-field-path).
    expect(predicate).toContainEqual(['in', ['status', ['Pending', 'Pending Start']]]);
    // Search is applied (one .or() group per word) over the module's field keys.
    const ors = predicate.filter(([m]) => m === 'or');
    expect(ors.length).toBeGreaterThanOrEqual(2);
    expect(String(ors[0][1][0])).toContain('data->>first_name.ilike');
  });

  it('keeps the 5k hard cap with a reproducible created_at,id order and flags capped', async () => {
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults({ records: { rows: 5000, count: 12400 } }), log));
    const res = await GET(buildRequest('/api/crm/records/ids?module_key=contacts'));
    const body = await res.json();
    expect(body.total).toBe(12400);
    expect(body.ids).toHaveLength(5000);
    expect(body.capped).toBe(true);
    const tail = recordsCalls(log).slice(-3).map((c) => [c.method, c.args]);
    expect(tail).toEqual([
      ['order', ['created_at', { ascending: false }]],
      ['order', ['id', { ascending: false }]],
      ['range', [0, 4999]],
    ]);
  });

  it('still honours the legacy group_id narrower (empty group → nothing selected, no records query)', async () => {
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), log));
    const res = await GET(buildRequest('/api/crm/records/ids?module_key=contacts&group_id=grp-1'));
    expect(await res.json()).toEqual({ ids: [], total: 0, capped: false });
    expect(log.find((c) => c.table === 'crm_contact_group_members' && c.method === 'eq' && c.args[0] === 'organization_id')?.args[1]).toBe(ORG_A);
  });

  it('400 without module_key', async () => {
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), []));
    const res = await GET(buildRequest('/api/crm/records/ids'));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/crm/records/ids — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ user: { id: USER_ID }, error: null });
  });

  it('anon → 401 and no query at all', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults(), log));
    const res = await GET(buildRequest('/api/crm/records/ids?module_key=contacts'));
    expect(res.status).toBe(401);
    expect(log).toHaveLength(0);
  });

  it("resolves the module inside the caller's org only and 404s on another org's module", async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ id: PROFILE_ID, organization_id: ORG_A }));
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults({ moduleOrg: ORG_B }), log));
    const res = await GET(buildRequest('/api/crm/records/ids?module_key=contacts'));
    expect(res.status).toBe(404);
    const moduleLookup = log.filter((c) => c.table === 'crm_modules').map((c) => [c.method, c.args]);
    expect(moduleLookup).toContainEqual(['eq', ['org_id', ORG_A]]);
    expect(recordsCalls(log)).toHaveLength(0);
  });

  it('org B caller never sees org A rows: the predicate is pinned to the caller org', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ id: 'prof-b', organization_id: ORG_B }));
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeRecordingClient(tableResults({ moduleOrg: ORG_B }), log));
    const res = await GET(buildRequest(`/api/crm/records/ids?module_key=contacts&filters=${encodeURIComponent(JSON.stringify(pendingLane))}`));
    expect(res.status).toBe(200);
    const predicate = predicateOf(log);
    expect(predicate[0]).toEqual(['eq', ['org_id', ORG_B]]);
    expect(predicate).not.toContainEqual(['eq', ['org_id', ORG_A]]);
  });
});
