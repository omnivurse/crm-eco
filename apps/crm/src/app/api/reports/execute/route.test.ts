import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile, buildSupabaseClient } from '@/test/helpers';
import { assertJsonbRpcArgs, REPORT_AGGREGATION_JSONB_PARAMS } from '@/lib/crm/status-lanes';

const ORG_A = '00000000-0000-0000-0000-000000000001';
const MODULE_ID = '00000000-0000-0000-0000-00000000c001';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { POST } from './route';

function mockClient() {
  return buildSupabaseClient(
    { crm_modules: { data: { id: MODULE_ID }, error: null } },
    {
      rpcResults: {
        execute_report_aggregation: {
          data: { rows: [{ status: 'Active', count_id: 3 }], total: 1 },
          error: null,
        },
        execute_report_query: { data: { rows: [], total: 0 }, error: null },
      },
    },
  );
}

function post(body: unknown) {
  return POST(buildRequest('/api/reports/execute', { method: 'POST', body }));
}

describe('POST /api/reports/execute — execute_report_aggregation arg shapes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_A }));
  });

  it('401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await post({ dataSource: 'contacts', grouping: [{ field: 'status' }] });
    expect(res.status).toBe(401);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  // Regression: prod 2026-08-22 — p_filters/p_grouping/p_aggregations/p_sorting
  // were JSON.stringify()'d, reaching Postgres as jsonb scalars → 22023
  // "cannot extract elements from a scalar" and every aggregation 500'd.
  it('passes the jsonb params as arrays (never strings) and scopes to the caller org', async () => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await post({
      dataSource: 'contacts',
      filters: [{ column: 'status', operator: 'eq', value: 'Active' }],
      filterLogic: { logic: 'or' },
      grouping: [{ field: 'status' }],
      aggregations: [{ field: 'id', function: 'count' }],
      sorting: [{ column: 'count_id', direction: 'desc' }],
      page: 2,
      pageSize: 50,
    });
    expect(res.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = client.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('execute_report_aggregation');
    expect(args.p_org_id).toBe(ORG_A);
    expect(args.p_table).toBe('crm_records');
    expect(args.p_org_column).toBe('org_id');
    expect(args.p_module_id).toBe(MODULE_ID);
    for (const key of REPORT_AGGREGATION_JSONB_PARAMS) {
      expect(Array.isArray(args[key]), `${key} must be an array`).toBe(true);
    }
    expect(() => assertJsonbRpcArgs(args)).not.toThrow();
    // `column` is normalised to `field`; value is passed through untouched.
    expect(args.p_filters).toEqual([{ field: 'status', operator: 'eq', value: 'Active', value2: undefined }]);
    expect(args.p_grouping).toEqual([{ field: 'status' }]);
    expect(args.p_aggregations).toEqual([{ field: 'id', function: 'count' }]);
    expect(args.p_sorting).toEqual([{ column: 'count_id', direction: 'desc' }]);
    expect(args.p_filter_logic).toBe('or');
    expect(args.p_limit).toBe(50);
    expect(args.p_offset).toBe(50);
    const json = await res.json();
    expect(json).toMatchObject({ isAggregated: true, total: 1, data: [{ status: 'Active', count_id: 3 }] });
  });

  it('sends empty arrays (not "[]" strings) for omitted grouping/sorting/aggregations', async () => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await post({ dataSource: 'members', aggregations: [{ field: 'id', function: 'count' }] });
    expect(res.status).toBe(200);
    const [, args] = client.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(args.p_table).toBe('members');
    expect(args.p_org_column).toBe('organization_id');
    expect(args.p_filters).toEqual([]);
    expect(args.p_grouping).toEqual([]);
    expect(args.p_sorting).toEqual([]);
    expect(() => assertJsonbRpcArgs(args)).not.toThrow();
  });

  it('surfaces an RPC error as 500 without leaking to the client as 200', async () => {
    const { client } = buildSupabaseClient(
      { crm_modules: { data: { id: MODULE_ID }, error: null } },
      { rpcResults: { execute_report_aggregation: { data: null, error: { message: 'boom' } } } },
    );
    mockCreateClient.mockResolvedValue(client);
    const res = await post({ dataSource: 'contacts', grouping: [{ field: 'status' }] });
    expect(res.status).toBe(500);
  });

  it('execute_report_query (text params) still receives JSON strings', async () => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await post({
      moduleId: MODULE_ID,
      columns: ['first_name'],
      filters: [],
      relatedModules: [{ module_key: 'leads', module_id: MODULE_ID, join_type: 'inclusive' }],
    });
    expect(res.status).toBe(200);
    const [fn, args] = client.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('execute_report_query');
    expect(typeof args.p_related_modules).toBe('string');
    expect(typeof args.p_columns).toBe('string');
    expect(typeof args.p_filters).toBe('string');
  });
});
