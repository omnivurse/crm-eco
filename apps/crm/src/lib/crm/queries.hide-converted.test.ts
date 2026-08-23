/**
 * LS-7b / D11 — the leads converted-row guard lives in the QUERY
 * (`applyHideConvertedLeadsFilter` inside `applyRecordListQuery`), not in a
 * post-range row filter, so the exact count, the page rows and the ids
 * endpoint agree: "Showing 1 to 25 of N" never lists fewer rows than it says.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthUser: vi.fn(),
  getAuthProfile: vi.fn(),
}));
vi.mock('@/lib/tenant', () => ({ getActiveTenant: async () => null }));

import { getRecords } from './queries';

type Call = { table: string; method: string; args: unknown[] };

function makeClient(rows: unknown[], count: number, log: Call[]) {
  const from = vi.fn((table: string) => {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_t, prop) {
        if (prop === 'then') {
          return (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
            Promise.resolve(table === 'crm_records' ? { data: rows, count, error: null } : { data: null, error: null }).then(onOk, onErr);
        }
        if (typeof prop !== 'string') return undefined;
        return (...args: unknown[]) => {
          log.push({ table, method: prop, args });
          return proxy;
        };
      },
    };
    const proxy = new Proxy({}, handler);
    return proxy;
  });
  return { from, rpc: vi.fn(async () => ({ data: null, error: null })), auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u' } }, error: null })) } };
}

const MODULE_ID = '00000000-0000-0000-0000-00000000c002';
const ORG = '00000000-0000-0000-0000-000000000001';

describe('getRecords — leads hide-converted is a query predicate (LS-7b)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the SQL guard and never drops rows after the range (rows === what the server returned)', async () => {
    const log: Call[] = [];
    // A row the DB returned (the SQL guard owns exclusion); the old post-range
    // filter would have dropped it and made the page shorter than its count.
    const rows = [
      { id: 'l-1', status: 'New', data: {} },
      { id: 'l-2', status: 'Converted', data: {} },
      { id: 'l-3', status: 'Working', data: { converted_contact_id: 'c-9' } },
    ];
    mockCreateClient.mockImplementation(() => makeClient(rows, 3, log));
    const result = await getRecords({ moduleId: MODULE_ID, orgId: ORG, moduleKey: 'leads', page: 1, pageSize: 25 });

    expect(result.total).toBe(3);
    expect(result.records.map((r) => r.id)).toEqual(['l-1', 'l-2', 'l-3']);

    const predicate = log.filter((c) => c.table === 'crm_records').map((c) => [c.method, c.args]);
    expect(predicate).toContainEqual(['neq', ['status', 'Converted']]);
    const ors = predicate.filter(([m]) => m === 'or').map(([, a]) => String((a as unknown[])[0]));
    expect(ors).toEqual(expect.arrayContaining([
      'data->>is_converted.is.null,data->>is_converted.neq.true',
      'data->>lead_status.is.null,data->>lead_status.neq.Converted',
      'data->>converted_contact_id.is.null,data->>converted_contact_id.eq.',
    ]));
  });

  it('contacts never get the converted-lead predicate', async () => {
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeClient([{ id: 'c-1', status: 'Converted', data: {} }], 1, log));
    const result = await getRecords({ moduleId: MODULE_ID, orgId: ORG, moduleKey: 'contacts' });
    expect(result.records).toHaveLength(1);
    const predicate = log.filter((c) => c.table === 'crm_records').map((c) => [c.method, c.args]);
    expect(predicate).not.toContainEqual(['neq', ['status', 'Converted']]);
  });

  it('duplicate ids in one page are still collapsed (the only post-range filter left)', async () => {
    const log: Call[] = [];
    mockCreateClient.mockImplementation(() => makeClient([{ id: 'l-1', status: 'New', data: {} }, { id: 'l-1', status: 'New', data: {} }], 2, log));
    const result = await getRecords({ moduleId: MODULE_ID, orgId: ORG, moduleKey: 'leads' });
    expect(result.records).toHaveLength(1);
  });
});
