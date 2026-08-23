import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile, buildSupabaseClient } from '@/test/helpers';

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const FIELD_ID = '00000000-0000-0000-0000-0000000f0001';
const OPT_A = '00000000-0000-0000-0000-00000000aaaa';
const OPT_B = '00000000-0000-0000-0000-00000000bbbb';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { GET, POST, PUT, PATCH, DELETE } from './route';

function fieldRow(options: unknown = null) {
  return { id: FIELD_ID, org_id: ORG_A, options };
}

function twoOptions() {
  return [
    { id: OPT_A, value: 'Silver PPO', label: 'Silver PPO', color: null, icon: null, is_default: false, is_active: true, display_order: 0, metadata: {} },
    { id: OPT_B, value: 'Gold HMO', label: 'Gold HMO', color: null, icon: null, is_default: false, is_active: true, display_order: 1, metadata: {} },
  ];
}

/** crm_fields serves both the org-scoped load (.single) and the save
 * (update…select awaited as a thenable). `field` feeds the load; `save`
 * feeds the awaited update chain. */
function mockClient(opts?: { field?: { data: unknown; error?: unknown }; save?: { data: unknown; error?: unknown } }) {
  const save = opts?.save ?? { data: [{ id: FIELD_ID }], error: null };
  const built = buildSupabaseClient({ crm_fields: save });
  const load = opts?.field ?? { data: fieldRow(twoOptions()), error: null };
  built.queryBuilders.crm_fields.single = vi.fn(() => Promise.resolve(load));
  return built;
}

const getUrl = (q: string) => `/api/crm/field-options?${q}`;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_A, crm_role: 'crm_admin' }));
});

describe('GET /api/crm/field-options', () => {
  it('401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(getUrl(`field_id=${FIELD_ID}`)));
    expect(res.status).toBe(401);
  });

  it('is readable by a plain crm_agent (pickers need the list)', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_A, crm_role: 'crm_agent' }));
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(getUrl(`field_id=${FIELD_ID}`)));
    expect(res.status).toBe(200);
    expect((await res.json()).options).toHaveLength(2);
  });

  it('400 when field_id is missing', async () => {
    mockCreateClient.mockResolvedValue(mockClient().client);
    const res = await GET(buildRequest(getUrl('')));
    expect(res.status).toBe(400);
  });

  it('pins the field lookup to the caller org and 404s on a foreign-org field', async () => {
    // Org-B caller: the .eq('org_id', ORG_B) predicate makes org A's field unresolvable.
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_B, crm_role: 'crm_agent' }));
    const { client, queryBuilders } = mockClient({ field: { data: null, error: { message: 'No rows' } } });
    mockCreateClient.mockResolvedValue(client);
    const res = await GET(buildRequest(getUrl(`field_id=${FIELD_ID}`)));
    expect(res.status).toBe(404);
    expect(queryBuilders.crm_fields.eq).toHaveBeenCalledWith('id', FIELD_ID);
    expect(queryBuilders.crm_fields.eq).toHaveBeenCalledWith('org_id', ORG_B);
    expect(queryBuilders.crm_fields.eq).not.toHaveBeenCalledWith('org_id', ORG_A);
  });

  it('filters inactive options by default and returns them with active_only=false', async () => {
    const options = twoOptions();
    options[1].is_active = false;
    const { client } = mockClient({ field: { data: fieldRow(options), error: null } });
    mockCreateClient.mockResolvedValue(client);

    const res = await GET(buildRequest(getUrl(`field_id=${FIELD_ID}`)));
    expect((await res.json()).options.map((o: { id: string }) => o.id)).toEqual([OPT_A]);

    const { client: client2 } = mockClient({ field: { data: fieldRow(options), error: null } });
    mockCreateClient.mockResolvedValue(client2);
    const resAll = await GET(buildRequest(getUrl(`field_id=${FIELD_ID}&active_only=false`)));
    expect((await resAll.json()).options).toHaveLength(2);
  });
});

describe('write permission gate (manager-or-admin, same predicate as the rest of the app)', () => {
  it.each(['crm_agent', 'crm_viewer', '', 'agent'])('403 for role %j on every write verb', async (role) => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_A, crm_role: role }));
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);

    const post = await POST(buildRequest(getUrl(''), { method: 'POST', body: { field_id: FIELD_ID, value: 'X', label: 'X' } }));
    const patch = await PATCH(buildRequest(getUrl(''), { method: 'PATCH', body: { field_id: FIELD_ID, updates: [{ id: OPT_A, label: 'Y' }] } }));
    const put = await PUT(buildRequest(getUrl(''), { method: 'PUT', body: { field_id: FIELD_ID, id: OPT_A, label: 'Y' } }));
    const del = await DELETE(buildRequest(getUrl(`field_id=${FIELD_ID}&id=${OPT_A}`), { method: 'DELETE' }));

    for (const res of [post, patch, put, del]) expect(res.status).toBe(403);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('allows crm_manager to write', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_A, crm_role: 'crm_manager' }));
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await PATCH(buildRequest(getUrl(''), { method: 'PATCH', body: { field_id: FIELD_ID, updates: [{ id: OPT_A, label: 'Renamed' }] } }));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/crm/field-options', () => {
  it('appends an option and persists via the org-scoped update', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await POST(buildRequest(getUrl(''), { method: 'POST', body: { field_id: FIELD_ID, value: 'Bronze EPO', label: 'Bronze EPO' } }));
    expect(res.status).toBe(201);
    const saved = (queryBuilders.crm_fields.update as ReturnType<typeof vi.fn>).mock.calls[0][0].options;
    expect(saved).toHaveLength(3);
    expect(queryBuilders.crm_fields.eq).toHaveBeenCalledWith('org_id', ORG_A);
  });

  it('409 on a case-insensitive duplicate value', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await POST(buildRequest(getUrl(''), { method: 'POST', body: { field_id: FIELD_ID, value: 'silver ppo', label: 'Silver again' } }));
    expect(res.status).toBe(409);
    expect(queryBuilders.crm_fields.update).not.toHaveBeenCalled();
  });

  it('404 when the field belongs to another org (no write happens)', async () => {
    const { client, queryBuilders } = mockClient({ field: { data: null, error: { message: 'No rows' } } });
    mockCreateClient.mockResolvedValue(client);
    const res = await POST(buildRequest(getUrl(''), { method: 'POST', body: { field_id: FIELD_ID, value: 'X', label: 'X' } }));
    expect(res.status).toBe(404);
    expect(queryBuilders.crm_fields.update).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/crm/field-options (bulk rename/deactivate/reorder)', () => {
  it('renames, deactivates, and reorders in one idempotent call', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await PATCH(
      buildRequest(getUrl(''), {
        method: 'PATCH',
        body: { field_id: FIELD_ID, updates: [{ id: OPT_A, label: 'Silver PPO (curated)', display_order: 1 }, { id: OPT_B, display_order: 0 }] },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.options.map((o: { id: string }) => o.id)).toEqual([OPT_B, OPT_A]);
    const renamed = body.options.find((o: { id: string }) => o.id === OPT_A);
    expect(renamed.label).toBe('Silver PPO (curated)');
    expect(renamed.value).toBe('Silver PPO'); // rename touches the label only — records hold the value
    expect(queryBuilders.crm_fields.update).toHaveBeenCalledTimes(1);
    expect(queryBuilders.crm_fields.eq).toHaveBeenCalledWith('org_id', ORG_A);
  });

  it('merge semantics: deactivating the loser keeps it in the list (never hard-deleted)', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await PATCH(
      buildRequest(getUrl(''), { method: 'PATCH', body: { field_id: FIELD_ID, updates: [{ id: OPT_B, is_active: false }] } })
    );
    expect(res.status).toBe(200);
    const saved = (queryBuilders.crm_fields.update as ReturnType<typeof vi.fn>).mock.calls[0][0].options;
    expect(saved).toHaveLength(2);
    expect(saved.find((o: { id: string }) => o.id === OPT_B).is_active).toBe(false);
    // No crm_records touched — the only table written is crm_fields.
    expect((client.from as ReturnType<typeof vi.fn>).mock.calls.every(([t]) => t === 'crm_fields')).toBe(true);
  });

  it('400 when a patch would deactivate every option (list may never go empty)', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await PATCH(
      buildRequest(getUrl(''), {
        method: 'PATCH',
        body: { field_id: FIELD_ID, updates: [{ id: OPT_A, is_active: false }, { id: OPT_B, is_active: false }] },
      })
    );
    expect(res.status).toBe(400);
    expect(queryBuilders.crm_fields.update).not.toHaveBeenCalled();
  });

  it('404 on an unknown option id, applying nothing', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await PATCH(
      buildRequest(getUrl(''), {
        method: 'PATCH',
        body: { field_id: FIELD_ID, updates: [{ id: '00000000-0000-0000-0000-00000000cccc', label: 'x' }] },
      })
    );
    expect(res.status).toBe(404);
    expect(queryBuilders.crm_fields.update).not.toHaveBeenCalled();
  });

  it('400 on a malformed body (empty updates array)', async () => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await PATCH(buildRequest(getUrl(''), { method: 'PATCH', body: { field_id: FIELD_ID, updates: [] } }));
    expect(res.status).toBe(400);
  });

  it('404 for an org-B caller patching org A\'s field (query pinned to caller org, no write)', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_B, crm_role: 'crm_admin' }));
    const { client, queryBuilders } = mockClient({ field: { data: null, error: { message: 'No rows' } } });
    mockCreateClient.mockResolvedValue(client);
    const res = await PATCH(
      buildRequest(getUrl(''), { method: 'PATCH', body: { field_id: FIELD_ID, updates: [{ id: OPT_A, label: 'hijack' }] } })
    );
    expect(res.status).toBe(404);
    expect(queryBuilders.crm_fields.eq).toHaveBeenCalledWith('org_id', ORG_B);
    expect(queryBuilders.crm_fields.eq).not.toHaveBeenCalledWith('org_id', ORG_A);
    expect(queryBuilders.crm_fields.update).not.toHaveBeenCalled();
  });

  it('500 (not silent success) when the update matches zero rows, e.g. RLS filtered it', async () => {
    const { client } = mockClient({ save: { data: [], error: null } });
    mockCreateClient.mockResolvedValue(client);
    const res = await PATCH(
      buildRequest(getUrl(''), { method: 'PATCH', body: { field_id: FIELD_ID, updates: [{ id: OPT_A, label: 'Renamed' }] } })
    );
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/crm/field-options (single option)', () => {
  it('updates one option in place', async () => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await PUT(buildRequest(getUrl(''), { method: 'PUT', body: { field_id: FIELD_ID, id: OPT_A, label: 'New label' } }));
    expect(res.status).toBe(200);
    expect((await res.json()).option.label).toBe('New label');
  });
});

describe('DELETE /api/crm/field-options (soft — deactivate, never remove)', () => {
  it('deactivates the option and keeps it in the stored list', async () => {
    const { client, queryBuilders } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await DELETE(buildRequest(getUrl(`field_id=${FIELD_ID}&id=${OPT_B}`), { method: 'DELETE' }));
    expect(res.status).toBe(200);
    const saved = (queryBuilders.crm_fields.update as ReturnType<typeof vi.fn>).mock.calls[0][0].options;
    expect(saved).toHaveLength(2); // still there
    expect(saved.find((o: { id: string }) => o.id === OPT_B).is_active).toBe(false);
  });

  it('400 when deleting would leave zero active options', async () => {
    const options = twoOptions();
    options[1].is_active = false;
    const { client, queryBuilders } = mockClient({ field: { data: fieldRow(options), error: null } });
    mockCreateClient.mockResolvedValue(client);
    const res = await DELETE(buildRequest(getUrl(`field_id=${FIELD_ID}&id=${OPT_A}`), { method: 'DELETE' }));
    expect(res.status).toBe(400);
    expect(queryBuilders.crm_fields.update).not.toHaveBeenCalled();
  });

  it('404 on an unknown option id', async () => {
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await DELETE(buildRequest(getUrl(`field_id=${FIELD_ID}&id=00000000-0000-0000-0000-00000000cccc`), { method: 'DELETE' }));
    expect(res.status).toBe(404);
  });
});

describe('legacy string-option lists (exactly what prod contacts.product / leads.product_type hold)', () => {
  const LEGACY = ['Silver PPO', 'Gold HMO'];

  it('the id from a GET still works on the very next PUT — no POST ever having persisted objects', async () => {
    // Two separate requests, each normalizing the RAW string list afresh:
    // deterministic ids make them agree. (A random id here reproduced the
    // live bug: first rename on the plan-name field 404ed on every load.)
    const { client } = mockClient({ field: { data: fieldRow(LEGACY), error: null } });
    mockCreateClient.mockResolvedValue(client);
    const got = await GET(buildRequest(getUrl(`field_id=${FIELD_ID}&active_only=false`)));
    expect(got.status).toBe(200);
    const target = (await got.json()).options.find((o: { value: string }) => o.value === 'Silver PPO');
    expect(target).toBeTruthy();

    const { client: client2, queryBuilders } = mockClient({ field: { data: fieldRow(LEGACY), error: null } });
    mockCreateClient.mockResolvedValue(client2);
    const res = await PUT(
      buildRequest(getUrl(''), {
        method: 'PUT',
        body: { field_id: FIELD_ID, id: target.id, label: 'Silver PPO (2026)' },
      })
    );
    expect(res.status).toBe(200); // also proves the derived id passes the zod .uuid() gate
    expect((await res.json()).option.label).toBe('Silver PPO (2026)');
    expect(queryBuilders.crm_fields.update).toHaveBeenCalledTimes(1);
  });

  it('a stale-id 404 carries plain copy — never the raw "Option not found: <uuid>" internals', async () => {
    const staleId = '00000000-0000-0000-0000-00000000cccc';
    const { client } = mockClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await PUT(
      buildRequest(getUrl(''), { method: 'PUT', body: { field_id: FIELD_ID, id: staleId, label: 'x' } })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).not.toMatch(/Option not found/);
    expect(body.error).not.toContain(staleId);
    expect(body.error).toMatch(/reload the page/);
  });
});
