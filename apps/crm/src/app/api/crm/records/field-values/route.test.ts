import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile, buildSupabaseClient } from '@/test/helpers';

const ORG_A = '00000000-0000-0000-0000-000000000001';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const MODULE_ID = '00000000-0000-0000-0000-00000000c001';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { GET } from './route';
import { parseFieldValuesRpcResult, parseLimit, FIELD_KEY_PATTERN } from '@/lib/crm/field-values';

type Client = ReturnType<typeof buildSupabaseClient>;

function mockClient(opts?: {
  module?: { data: unknown; error?: unknown };
  field?: { data: unknown; error?: unknown };
  rpc?: { data?: unknown; error?: unknown };
}): Client {
  return buildSupabaseClient(
    {
      crm_modules: opts?.module ?? { data: { id: MODULE_ID, org_id: ORG_A }, error: null },
      crm_fields: opts?.field ?? { data: { id: 'field-1' }, error: null },
    },
    {
      rpcResults: {
        crm_field_distinct_values: opts?.rpc ?? {
          data: [
            { value: 'Walker Bronze HMO 5000', count: 7 },
            { value: 'Silver PPO', count: '3' }, // bigint may arrive as a string over PostgREST
          ],
          error: null,
        },
      },
    },
  );
}

function url(q: string) {
  return `/api/crm/records/field-values?${q}`;
}

describe('GET /api/crm/records/field-values', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_A }));
  });

  it('401 when unauthenticated (no query touches the DB)', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(url('module_key=contacts&key=health_insurance_plan_name')));
    expect(res.status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('400 when module_key is missing', async () => {
    mockCreateClient.mockResolvedValue(mockClient().client);
    const res = await GET(buildRequest(url('key=health_insurance_plan_name')));
    expect(res.status).toBe(400);
  });

  it.each([
    ['missing', 'module_key=contacts'],
    ['empty', 'module_key=contacts&key='],
    ['uppercase', 'module_key=contacts&key=Health_Plan'],
    ['injection-shaped', `module_key=contacts&key=${encodeURIComponent("x'; drop table crm_records; --")}`],
    ['jsonb path', `module_key=contacts&key=${encodeURIComponent('data->>plan')}`],
    ['too long', `module_key=contacts&key=${'a'.repeat(65)}`],
  ])('400 on a bad key (%s) before any DB call', async (_label, q) => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(url(q)));
    expect(res.status).toBe(400);
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each([['0'], ['101'], ['abc'], ['-1'], ['2.5']])('400 on limit=%s', async (limit) => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(url(`module_key=contacts&key=health_insurance_plan_name&limit=${limit}`)));
    expect(res.status).toBe(400);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('404 when the module is not in the caller org (module lookup is pinned to profile.organization_id)', async () => {
    const { client, queryBuilders } = mockClient({ module: { data: null, error: null } });
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(url('module_key=contacts&key=health_insurance_plan_name')));
    expect(res.status).toBe(404);
    expect(queryBuilders.crm_modules.eq).toHaveBeenCalledWith('org_id', ORG_A);
    expect(queryBuilders.crm_modules.eq).toHaveBeenCalledWith('key', 'contacts');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('404 when the module row belongs to another org (defence in depth)', async () => {
    const { client } = mockClient({ module: { data: { id: MODULE_ID, org_id: ORG_B }, error: null } });
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(url('module_key=contacts&key=health_insurance_plan_name')));
    expect(res.status).toBe(404);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('400 when the key is not a crm_fields key of that module (allowlist)', async () => {
    const { client, queryBuilders } = mockClient({ field: { data: null, error: null } });
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(url('module_key=contacts&key=not_a_field')));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'key is not a field of this module' });
    expect(queryBuilders.crm_fields.eq).toHaveBeenCalledWith('org_id', ORG_A);
    expect(queryBuilders.crm_fields.eq).toHaveBeenCalledWith('module_id', MODULE_ID);
    expect(queryBuilders.crm_fields.eq).toHaveBeenCalledWith('key', 'not_a_field');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('200: returns top values + counts, calls the RPC with module id / key / limit, private 60s cache', async () => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(url('module_key=contacts&key=health_insurance_plan_name')));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, max-age=60');
    expect(await res.json()).toEqual({
      module_key: 'contacts',
      key: 'health_insurance_plan_name',
      values: [
        { value: 'Walker Bronze HMO 5000', count: 7 },
        { value: 'Silver PPO', count: 3 },
      ],
      total: 10,
    });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('crm_field_distinct_values', {
      p_module_id: MODULE_ID,
      p_key: 'health_insurance_plan_name',
      p_limit: 25,
    });
  });

  it('200: honours an explicit limit and an empty result', async () => {
    const { client } = mockClient({ rpc: { data: [], error: null } });
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(url('module_key=contacts&key=health_insurance_plan_name&limit=5')));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ module_key: 'contacts', key: 'health_insurance_plan_name', values: [], total: 0 });
    expect(client.rpc).toHaveBeenCalledWith('crm_field_distinct_values', expect.objectContaining({ p_limit: 5 }));
  });

  it('500 when the RPC fails (error not leaked)', async () => {
    const { client } = mockClient({ rpc: { data: null, error: { message: 'boom' } } });
    mockCreateClient.mockResolvedValue(client);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(buildRequest(url('module_key=contacts&key=health_insurance_plan_name')));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to load field values' });
    spy.mockRestore();
  });
});

describe('field-values helpers', () => {
  it('FIELD_KEY_PATTERN mirrors the RPC guard ^[a-z0-9_]{1,64}$', () => {
    expect(FIELD_KEY_PATTERN.test('health_insurance_plan_name')).toBe(true);
    expect(FIELD_KEY_PATTERN.test('a'.repeat(64))).toBe(true);
    expect(FIELD_KEY_PATTERN.test('a'.repeat(65))).toBe(false);
    expect(FIELD_KEY_PATTERN.test('Plan')).toBe(false);
    expect(FIELD_KEY_PATTERN.test('plan name')).toBe(false);
    expect(FIELD_KEY_PATTERN.test('')).toBe(false);
  });

  it('parseLimit: default / bounds / garbage', () => {
    expect(parseLimit(null)).toBe(25);
    expect(parseLimit('')).toBe(25);
    expect(parseLimit('1')).toBe(1);
    expect(parseLimit('100')).toBe(100);
    expect(parseLimit('101')).toBeNull();
    expect(parseLimit('0')).toBeNull();
    expect(parseLimit('x')).toBeNull();
    expect(parseLimit('1e2')).toBeNull();
  });

  it('parseFieldValuesRpcResult: coerces bigint strings, drops blanks / malformed rows', () => {
    expect(
      parseFieldValuesRpcResult([
        { value: 'A', count: '2' },
        { value: 'B', count: 1 },
        { value: '', count: 9 },
        { value: '   ', count: 9 },
        { value: 'C', count: 'NaN' },
        { value: 42, count: 1 },
        null,
        'junk',
      ]),
    ).toEqual([
      { value: 'A', count: 2 },
      { value: 'B', count: 1 },
    ]);
    expect(parseFieldValuesRpcResult(null)).toEqual([]);
    expect(parseFieldValuesRpcResult({ value: 'A', count: 1 })).toEqual([]);
  });
});
