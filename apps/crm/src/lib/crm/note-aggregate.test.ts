import { describe, expect, it, vi } from 'vitest';
import {
  addSameEmailContactSiblings,
  normalizeEmailForNoteAggregate,
  resolveNoteSourceRecordIdsWithClient,
  type NoteAggregateRecord,
} from './note-aggregate';
import type { SupabaseClient } from '@supabase/supabase-js';

const ORG_A = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
const ORG_B = 'b17e7228-2ea0-4582-8464-562c3e8ac56e';
const CONTACT_A = '02a35029-5ebe-4160-b09f-99982d3bccfd';
const CONTACT_B = 'a587ff28-694b-4ebb-b5ab-d9753861d0d4';
const CONTACT_OTHER_ORG = '4aa89f45-04b8-454b-aac0-ecedc4b5a4a4';

function createChainMock(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.ilike = vi.fn(self);
  chain.neq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.in = vi.fn(self);
  chain.or = vi.fn(self);
  // Terminal — last call resolves
  chain.then = undefined;
  // Make the chain thenable so `await query` works
  const promise = Promise.resolve(result);
  Object.assign(chain, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  });
  return chain;
}

describe('normalizeEmailForNoteAggregate', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmailForNoteAggregate('  Jane@Example.COM ')).toBe(
      'jane@example.com',
    );
  });

  it('returns null for empty / whitespace', () => {
    expect(normalizeEmailForNoteAggregate(null)).toBeNull();
    expect(normalizeEmailForNoteAggregate('')).toBeNull();
    expect(normalizeEmailForNoteAggregate('   ')).toBeNull();
  });
});

describe('addSameEmailContactSiblings', () => {
  it('adds same-email contact siblings in the same org', async () => {
    const chain = createChainMock({
      data: [{ id: CONTACT_B, crm_modules: { key: 'contacts' } }],
      error: null,
    });
    const from = vi.fn(() => chain);
    const supabase = { from } as unknown as SupabaseClient;
    const into = new Set<string>([CONTACT_A]);

    await addSameEmailContactSiblings(
      supabase,
      ORG_A,
      'janebaby311@gmail.com',
      CONTACT_A,
      into,
    );

    expect(from).toHaveBeenCalledWith('crm_records');
    expect(chain.eq).toHaveBeenCalledWith('org_id', ORG_A);
    expect(chain.ilike).toHaveBeenCalledWith('email', 'janebaby311@gmail.com');
    expect(chain.eq).toHaveBeenCalledWith('crm_modules.key', 'contacts');
    expect(into.has(CONTACT_B)).toBe(true);
  });

  it('skips lookup when email is empty', async () => {
    const from = vi.fn();
    const supabase = { from } as unknown as SupabaseClient;
    const into = new Set<string>([CONTACT_A]);

    await addSameEmailContactSiblings(supabase, ORG_A, '  ', CONTACT_A, into);

    expect(from).not.toHaveBeenCalled();
    expect([...into]).toEqual([CONTACT_A]);
  });

  it('skips lookup when org_id is missing', async () => {
    const from = vi.fn();
    const supabase = { from } as unknown as SupabaseClient;
    const into = new Set<string>([CONTACT_A]);

    await addSameEmailContactSiblings(
      supabase,
      null,
      'janebaby311@gmail.com',
      CONTACT_A,
      into,
    );

    expect(from).not.toHaveBeenCalled();
  });

  it('ignores rows whose joined module is not contacts', async () => {
    const chain = createChainMock({
      data: [
        { id: CONTACT_B, crm_modules: { key: 'members' } },
        { id: CONTACT_OTHER_ORG, crm_modules: { key: 'contacts' } },
      ],
      error: null,
    });
    const supabase = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
    const into = new Set<string>([CONTACT_A]);

    await addSameEmailContactSiblings(
      supabase,
      ORG_A,
      'janebaby311@gmail.com',
      CONTACT_A,
      into,
    );

    expect(into.has(CONTACT_B)).toBe(false);
    expect(into.has(CONTACT_OTHER_ORG)).toBe(true);
  });
});

describe('resolveNoteSourceRecordIdsWithClient', () => {
  it('does not query same-email siblings for leads', async () => {
    const linksChain = createChainMock({ data: [], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'crm_record_links') return linksChain;
      throw new Error(`Unexpected table for leads path: ${table}`);
    });
    const supabase = { from } as unknown as SupabaseClient;
    const record: NoteAggregateRecord = {
      id: CONTACT_A,
      org_id: ORG_A,
      email: 'janebaby311@gmail.com',
      data: {},
    };

    const ids = await resolveNoteSourceRecordIdsWithClient(
      supabase,
      record,
      'leads',
    );

    expect(ids).toEqual([CONTACT_A]);
    expect(from).toHaveBeenCalledWith('crm_record_links');
    expect(from).not.toHaveBeenCalledWith('crm_records');
  });

  it('includes same-email contact siblings for contacts module', async () => {
    const linksChain = createChainMock({ data: [], error: null });
    const recordsChain = createChainMock({
      data: [{ id: CONTACT_B, crm_modules: { key: 'contacts' } }],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'crm_record_links') return linksChain;
      if (table === 'crm_records') return recordsChain;
      throw new Error(`Unexpected table: ${table}`);
    });
    const supabase = { from } as unknown as SupabaseClient;
    const record: NoteAggregateRecord = {
      id: CONTACT_A,
      org_id: ORG_A,
      email: 'JaneBaby311@gmail.com',
      data: {},
    };

    const ids = await resolveNoteSourceRecordIdsWithClient(
      supabase,
      record,
      'contacts',
    );

    expect(ids).toContain(CONTACT_A);
    expect(ids).toContain(CONTACT_B);
    expect(recordsChain.eq).toHaveBeenCalledWith('org_id', ORG_A);
    expect(recordsChain.eq).toHaveBeenCalledWith('crm_modules.key', 'contacts');
    expect(recordsChain.ilike).toHaveBeenCalledWith(
      'email',
      'janebaby311@gmail.com',
    );
  });

  it('does not include siblings when org differs (query scoped to record.org_id)', async () => {
    const linksChain = createChainMock({ data: [], error: null });
    const recordsChain = createChainMock({
      data: [], // empty — other-org siblings never returned by org-scoped query
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'crm_record_links') return linksChain;
      if (table === 'crm_records') return recordsChain;
      throw new Error(`Unexpected table: ${table}`);
    });
    const supabase = { from } as unknown as SupabaseClient;
    const record: NoteAggregateRecord = {
      id: CONTACT_A,
      org_id: ORG_B,
      email: 'janebaby311@gmail.com',
      data: {},
    };

    const ids = await resolveNoteSourceRecordIdsWithClient(
      supabase,
      record,
      'contacts',
    );

    expect(ids).toEqual([CONTACT_A]);
    expect(recordsChain.eq).toHaveBeenCalledWith('org_id', ORG_B);
  });
});
