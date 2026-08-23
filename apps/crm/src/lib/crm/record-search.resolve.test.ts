/**
 * NV-4 — `resolveSearchRows` is the ONE global-search resolver (⌘K palette API
 * + /crm/search page). Phone-only and member-# queries, RPC fallbacks, merge
 * order and the converted-lead filter, against a mocked Supabase client.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSupabaseClient } from '@/test/helpers';
import { resolveSearchRows, type GlobalSearchRow } from './record-search';

const ORG = '00000000-0000-0000-0000-000000000001';

function row(over: Partial<GlobalSearchRow> & { id: string }): GlobalSearchRow {
  return {
    title: 'Wendy Walker',
    email: null,
    phone: '(555) 010-7788',
    status: 'Active',
    module_id: 'mod-contacts',
    data: { first_name: 'Wendy', last_name: 'Walker', member_number: '7788001' },
    module_key: 'contacts',
    module_name: 'Contact',
    module_name_plural: 'Contacts',
    match_type: 'exact',
    rank: 1,
    ...over,
  };
}

/** A `crm_records` + `crm_modules!inner` join row (ilike / identifier paths). */
function joinRow(id: string, moduleKey = 'contacts', data: Record<string, unknown> = {}) {
  return {
    id,
    title: 'Wendy Walker',
    email: null,
    phone: '5550107788',
    status: 'Active',
    module_id: `mod-${moduleKey}`,
    data,
    crm_modules: { id: `mod-${moduleKey}`, key: moduleKey, name: 'Contact', name_plural: 'Contacts' },
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('resolveSearchRows — phone-only queries', () => {
  it('a spaced phone goes to crm_phone_lookup with digits only; no text RPC, no identifier pass', async () => {
    const { client } = buildSupabaseClient(
      { crm_records: { data: [joinRow('ident-1')], error: null } },
      { rpcResults: { crm_phone_lookup: { data: [row({ id: 'wendy' })], error: null } } },
    );
    // Whitespace is ignored by the digit-ratio test, so this is phone-only;
    // it is not a bare digit run, so the member-# pass is skipped.
    const rows = await resolveSearchRows(client, ORG, { query: '555 010 7788', limit: 50 });
    expect(rows.map((r) => r.id)).toEqual(['wendy']);
    expect(client.rpc).toHaveBeenCalledWith('crm_phone_lookup', {
      p_org_id: ORG,
      p_query: '5550107788',
      p_module_key: null,
      p_limit: 50,
    });
    expect(client.rpc).not.toHaveBeenCalledWith('crm_smart_search', expect.anything());
    expect(client.from).not.toHaveBeenCalled();
  });

  it('a punctuated phone "(555) 010-7788" is a mixed query: text RPC first, phone hits merged behind', async () => {
    const { client } = buildSupabaseClient(
      { crm_records: { data: [], error: null } },
      {
        rpcResults: {
          crm_smart_search: { data: [], error: null },
          crm_phone_lookup: { data: [row({ id: 'wendy' })], error: null },
        },
      },
    );
    const rows = await resolveSearchRows(client, ORG, { query: '(555) 010-7788', limit: 50 });
    expect(rows.map((r) => r.id)).toEqual(['wendy']);
    expect(client.rpc).toHaveBeenCalledWith('crm_smart_search', expect.objectContaining({ p_query: '(555) 010-7788' }));
    expect(client.rpc).toHaveBeenCalledWith('crm_phone_lookup', expect.objectContaining({ p_query: '5550107788' }));
  });

  it('a bare digit run is a phone AND a possible member #: phone hits first, identifier hits behind', async () => {
    const { client, queryBuilders } = buildSupabaseClient(
      { crm_records: { data: [joinRow('member-7788001', 'contacts', { member_number: '7788001' })], error: null } },
      { rpcResults: { crm_phone_lookup: { data: [row({ id: 'phone-hit' })], error: null } } },
    );
    const rows = await resolveSearchRows(client, ORG, { query: '7788001', limit: 50 });
    expect(rows.map((r) => r.id)).toEqual(['phone-hit', 'member-7788001']);
    const qb = queryBuilders.crm_records;
    expect(qb.or).toHaveBeenCalledWith(
      'data->>member_number.ilike.%7788001%,data->>sharing_member_id.ilike.%7788001%,data->>e123_member_id.ilike.%7788001%',
    );
    expect(qb.eq).toHaveBeenCalledWith('org_id', ORG);
    expect(qb.is).toHaveBeenCalledWith('deleted_at', null);
    // Identifier rows are normalised to the RPC row shape.
    expect(rows[1]).toMatchObject({ module_key: 'contacts', module_name_plural: 'Contacts', match_type: 'exact', rank: 0.75 });
  });

  it('a member # that is not a phone still resolves (phone RPC empty, identifier pass hits)', async () => {
    const { client } = buildSupabaseClient(
      { crm_records: { data: [joinRow('member-only', 'members', { member_number: '123456789' })], error: null } },
      { rpcResults: { crm_phone_lookup: { data: [], error: null } } },
    );
    const rows = await resolveSearchRows(client, ORG, { query: '123456789', limit: 50 });
    expect(rows.map((r) => r.id)).toEqual(['member-only']);
  });

  it('module filter reaches the phone RPC and the identifier pass', async () => {
    const { client, queryBuilders } = buildSupabaseClient(
      { crm_records: { data: [], error: null } },
      { rpcResults: { crm_phone_lookup: { data: [], error: null } } },
    );
    await resolveSearchRows(client, ORG, { query: '5550107788', moduleFilter: 'members', limit: 10 });
    expect(client.rpc).toHaveBeenCalledWith('crm_phone_lookup', expect.objectContaining({ p_module_key: 'members', p_limit: 10 }));
    expect(queryBuilders.crm_records.eq).toHaveBeenCalledWith('crm_modules.key', 'members');
  });

  it('falls back to the multi-format ilike pass when crm_phone_lookup is missing', async () => {
    const { client, queryBuilders } = buildSupabaseClient(
      { crm_records: { data: [joinRow('fallback')], error: null } },
      { rpcResults: { crm_phone_lookup: { data: null, error: { message: 'function does not exist' } } } },
    );
    const rows = await resolveSearchRows(client, ORG, { query: '5550107788', limit: 50 });
    // Phone fallback + identifier pass both hit the same row → once.
    expect(rows.map((r) => r.id)).toEqual(['fallback']);
    const orArgs = (queryBuilders.crm_records.or as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    const phoneArg = orArgs.find((a) => a.startsWith('phone.ilike.'));
    expect(phoneArg).toContain('phone.ilike.%5550107788%');
    expect(phoneArg).toContain('phone.ilike.%(555) 010-7788%');
    expect(phoneArg).toContain('data->>mobile.ilike.%5550107788%');
  });
});

describe('resolveSearchRows — text queries', () => {
  it('name queries use crm_smart_search with the threshold; a thin result set is supplemented by the JSONB ilike pass', async () => {
    const { client } = buildSupabaseClient(
      { crm_records: { data: [joinRow('supplement')], error: null } },
      { rpcResults: { crm_smart_search: { data: [row({ id: 'rpc-hit', match_type: 'fuzzy', rank: 0.4 })], error: null } } },
    );
    const rows = await resolveSearchRows(client, ORG, { query: 'Wendy Walker', limit: 50, threshold: 0.3 });
    expect(client.rpc).toHaveBeenCalledWith('crm_smart_search', {
      p_org_id: ORG,
      p_query: 'Wendy Walker',
      p_module_key: null,
      p_limit: 50,
      p_similarity_threshold: 0.3,
    });
    expect(rows.map((r) => r.id)).toEqual(['rpc-hit', 'supplement']);
  });

  it('a full RPC page skips the supplement (one query for ordinary name searches)', async () => {
    const hits = Array.from({ length: 5 }, (_, i) => row({ id: `h${i}` }));
    const { client } = buildSupabaseClient({}, { rpcResults: { crm_smart_search: { data: hits, error: null } } });
    const rows = await resolveSearchRows(client, ORG, { query: 'Walker', limit: 50 });
    expect(rows).toHaveLength(5);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('mixed "name + digits" merges phone hits behind the text hits', async () => {
    const { client } = buildSupabaseClient(
      { crm_records: { data: [], error: null } },
      {
        rpcResults: {
          crm_smart_search: { data: [row({ id: 'text' })], error: null },
          crm_phone_lookup: { data: [row({ id: 'phone' }), row({ id: 'text' })], error: null },
        },
      },
    );
    const rows = await resolveSearchRows(client, ORG, { query: 'Wendy 7788', limit: 50 });
    expect(rows.map((r) => r.id)).toEqual(['text', 'phone']);
  });

  it('drops converted leads (audit trail) on every path', async () => {
    const { client } = buildSupabaseClient(
      {},
      {
        rpcResults: {
          crm_smart_search: {
            data: [
              row({ id: 'lead-converted', module_key: 'leads', status: 'Converted' }),
              row({ id: 'lead-open', module_key: 'leads', status: 'New' }),
              row({ id: 'c1' }), row({ id: 'c2' }), row({ id: 'c3' }),
            ],
            error: null,
          },
        },
      },
    );
    const rows = await resolveSearchRows(client, ORG, { query: 'Walker', limit: 50 });
    expect(rows.map((r) => r.id)).toEqual(['lead-open', 'c1', 'c2', 'c3']);
  });

  it('an empty / blank query touches nothing', async () => {
    const { client } = buildSupabaseClient();
    expect(await resolveSearchRows(client, ORG, { query: '   ', limit: 50 })).toEqual([]);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });
});
