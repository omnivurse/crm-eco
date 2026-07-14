import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mocks — org_id must be a UUID (matches createRecordSchema)
const VALID_ORG_ID = '00000000-0000-0000-0000-000000000001';
const mockProfile = buildProfile({ organization_id: VALID_ORG_ID });
const mockCreateClient = vi.fn();
const mockGetAuthUser = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthUser: () => mockGetAuthUser(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

vi.mock('@/lib/automation', () => ({
  executeMatchingWorkflows: vi.fn(() => Promise.resolve()),
  applyScoring: vi.fn(() => Promise.resolve()),
}));

import { GET, POST } from './route';

const VALID_MODULE_ID = '00000000-0000-0000-0000-000000000002';

function buildMockSupabase(overrides?: {
  moduleResult?: { data: unknown; error: unknown };
  recordsResult?: { data: unknown; error: unknown; count?: number | null };
  insertResult?: { data: unknown; error: unknown };
}) {
  const chainable: Record<string, any> = {};
  const methods = ['select', 'eq', 'or', 'order', 'range', 'insert'];
  for (const m of methods) {
    chainable[m] = vi.fn(() => chainable);
  }
  // Module resolution now terminates in .maybeSingle() (see route.ts).
  chainable.maybeSingle = vi.fn(() =>
    Promise.resolve(
      overrides?.moduleResult ?? { data: { id: 'mod-1', org_id: VALID_ORG_ID }, error: null }
    )
  );
  // Determine which result to return based on call sequence
  let callCount = 0;
  chainable.single = vi.fn(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(
        overrides?.moduleResult ?? { data: { id: 'mod-1', org_id: VALID_ORG_ID }, error: null }
      );
    }
    return Promise.resolve(overrides?.insertResult ?? { data: { id: 'rec-1' }, error: null });
  });
  // For the select('*', { count: 'exact' }) path — GET records
  const originalSelect = chainable.select;
  chainable.select = vi.fn((...args: unknown[]) => {
    if (args.length === 2 && (args[1] as any)?.count === 'exact') {
      // This is the records query — resolve as a promise (not .single())
      const recordsChain: Record<string, any> = {};
      for (const m of methods) {
        recordsChain[m] = vi.fn(() => recordsChain);
      }
      recordsChain.then = (resolve: Function) =>
        resolve(overrides?.recordsResult ?? { data: [{ id: 'rec-1' }], count: 1, error: null });
      return recordsChain;
    }
    return chainable;
  });

  return { from: vi.fn(() => chainable), chainable };
}

describe('GET /api/crm/records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost:3000/api/crm/records?module_key=contacts');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when module_key is missing', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const req = buildRequest('http://localhost:3000/api/crm/records');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('module_key is required');
  });

  it('returns 404 when module not found', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const sb = buildMockSupabase({
      moduleResult: { data: null, error: { message: 'Not found' } },
    });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/crm/records?module_key=nonexistent');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 404 when module belongs to different org', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    // The route now scopes module resolution in SQL via .eq('org_id', ...), so a
    // module owned by another org is filtered out entirely and the query returns
    // no row. maybeSingle() therefore yields { data: null }.
    const sb = buildMockSupabase({
      moduleResult: { data: null, error: null },
    });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/crm/records?module_key=contacts');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns records successfully with pagination', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const records = [{ id: 'rec-1', title: 'Test' }];
    const sb = buildMockSupabase({
      recordsResult: { data: records, count: 1, error: null },
    });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/crm/records?module_key=contacts&page=1&page_size=50');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.records).toEqual(records);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
  });

  it('defaults invalid page_size to 25', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const sb = buildMockSupabase({
      recordsResult: { data: [], count: 0, error: null },
    });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/crm/records?module_key=contacts&page_size=500');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pageSize).toBe(25);
  });
});

describe('POST /api/crm/records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue({ user: null, error: null });
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost:3000/api/crm/records', {
      method: 'POST',
      body: { org_id: VALID_ORG_ID, module_id: VALID_MODULE_ID, data: {} },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing required fields)', async () => {
    mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
    const req = buildRequest('http://localhost:3000/api/crm/records', {
      method: 'POST',
      body: { data: {} }, // missing org_id, module_id
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 for viewer role', async () => {
    const viewerProfile = buildProfile({ crm_role: 'crm_viewer' });
    mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mockGetAuthProfile.mockResolvedValue(viewerProfile);
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
    const req = buildRequest('http://localhost:3000/api/crm/records', {
      method: 'POST',
      body: {
        org_id: VALID_ORG_ID,
        module_id: VALID_MODULE_ID,
        data: { name: 'Test' },
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('creates a record successfully', async () => {
    mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const newRecord = { id: 'rec-new', org_id: VALID_ORG_ID, module_id: VALID_MODULE_ID, data: { name: 'Test' } };
    const chainable: Record<string, any> = {};
    ['insert', 'select', 'eq'].forEach(m => {
      chainable[m] = vi.fn(() => chainable);
    });
    let singleCount = 0;
    chainable.single = vi.fn(() => {
      singleCount++;
      if (singleCount === 1) {
        return Promise.resolve({
          data: { id: VALID_MODULE_ID, org_id: VALID_ORG_ID },
          error: null,
        });
      }
      return Promise.resolve({ data: newRecord, error: null });
    });
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => chainable),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    });

    const req = buildRequest('http://localhost:3000/api/crm/records', {
      method: 'POST',
      body: {
        org_id: VALID_ORG_ID,
        module_id: VALID_MODULE_ID,
        data: { name: 'Test' },
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('rec-new');
  });

  it('returns 500 on DB insert error', async () => {
    mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const chainable: Record<string, any> = {};
    ['insert', 'select', 'eq'].forEach(m => {
      chainable[m] = vi.fn(() => chainable);
    });
    let singleCount = 0;
    chainable.single = vi.fn(() => {
      singleCount++;
      if (singleCount === 1) {
        return Promise.resolve({
          data: { id: VALID_MODULE_ID, org_id: VALID_ORG_ID },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: 'DB error' } });
    });
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => chainable),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    });

    const req = buildRequest('http://localhost:3000/api/crm/records', {
      method: 'POST',
      body: {
        org_id: VALID_ORG_ID,
        module_id: VALID_MODULE_ID,
        data: { name: 'Test' },
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
