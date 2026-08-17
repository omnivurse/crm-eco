import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMemberCrmRecordIds } from './resolve-member-crm-record-query';
import type { MemberCrmLookupInput } from './resolve-member-crm-record';

const ORG_ID = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';

function createThenableChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of [
    'select',
    'eq',
    'is',
    'in',
    'or',
    'ilike',
    'contains',
  ]) {
    chain[method] = vi.fn(self);
  }
  const promise = Promise.resolve(result);
  Object.assign(chain, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  });
  return chain;
}

function createCountingClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  let queryCount = 0;
  const from = vi.fn(() => {
    queryCount += 1;
    return createThenableChain(result);
  });
  return {
    supabase: { from } as unknown as SupabaseClient,
    getQueryCount: () => queryCount,
  };
}

function buildMembers(count: number): MemberCrmLookupInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    email: `member${i}@example.com`,
    member_number: `MN${String(i).padStart(4, '0')}`,
    first_name: 'Test',
    last_name: `User${i}`,
  }));
}

describe('resolveMemberCrmRecordIds', () => {
  it('stays under a bounded query budget for a 200-row members page', async () => {
    const { supabase, getQueryCount } = createCountingClient();
    const members = buildMembers(200);

    await resolveMemberCrmRecordIds(supabase, ORG_ID, members);

    // Sequential per-member / per-email lookups (~600) time out the
    // /api/members route (prod 504). Batched IN/OR lookups must stay
    // well under Vercel's function budget.
    expect(getQueryCount()).toBeLessThanOrEqual(20);
  });

  it('maps each member to the best matching CRM record from batched rows', async () => {
    const members = buildMembers(2);
    const rows = [
      {
        id: 'rec-linked-0',
        email: 'other0@example.com',
        phone: null,
        source_record_id: null,
        market_type: null,
        updated_at: '2026-01-01T00:00:00Z',
        data: { linked_member_id: members[0].id, first_name: 'Test', last_name: 'User0' },
        crm_modules: { key: 'contacts' },
      },
      {
        id: 'rec-zoho-1',
        email: 'member1@example.com',
        phone: null,
        source_record_id: 'zcrm_1',
        market_type: 'healthshare',
        updated_at: '2026-01-02T00:00:00Z',
        data: {
          member_number: members[1].member_number,
          first_name: 'Test',
          last_name: 'User1',
          iua_amount: '2500',
        },
        crm_modules: { key: 'contacts' },
      },
    ];
    const { supabase } = createCountingClient({ data: rows, error: null });

    const resolved = await resolveMemberCrmRecordIds(supabase, ORG_ID, members);

    expect(resolved.get(members[0].id)).toBe('rec-linked-0');
    expect(resolved.get(members[1].id)).toBe('rec-zoho-1');
  });
});
