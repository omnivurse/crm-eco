/**
 * PI-2 — `/crm/r/<segment>` used to hand the raw URL segment to `uuid` columns.
 *
 * Postgres does not just fail to match: it aborts the statement with
 * `invalid input syntax for type uuid: "…"`, and resolve-record logged that to
 * the server console, which `next dev` forwards into the browser. Every typo'd
 * or crawled record URL produced a console error next to a page that rendered
 * its not-found state perfectly well.
 *
 * These tests pin the shape of the guard: a non-uuid never reaches a uuid
 * column, and a real uuid still walks the whole merge chain.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEEPER = '11111111-1111-4111-8111-111111111111';
const STALE = '22222222-2222-4222-8222-222222222222';
const ORG_ID = '33333333-3333-4333-8333-333333333333';

/** Every `.eq(column, value)` any client made, in order. */
let eqCalls: Array<{ table: string; column: string; value: unknown }> = [];
/** Rows the admin client should answer with, keyed by probe label. */
let auditRows: Record<string, { diff: unknown; created_at: string | null } | null> = {};
let recordRows: Record<string, { id: string; title: string | null } | null> = {};
/** Whether the RLS client sees the record. */
let rlsSees = false;

function makeBuilder(table: string) {
  const state: { column?: string; value?: unknown; jsonKey?: string } = {};
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    in: chain,
    is: chain,
    order: chain,
    limit: chain,
    eq: (column: string, value: unknown) => {
      eqCalls.push({ table, column, value });
      if (column.startsWith('diff')) state.jsonKey = column;
      if (column === 'entity_id' || column === 'id') {
        state.column = column;
        state.value = value;
      }
      return builder;
    },
    maybeSingle: async () => {
      if (table === 'crm_audit_log') {
        const label = state.jsonKey === 'diff->>deleted_id'
          ? 'diff_deleted_id'
          : state.jsonKey === 'diff->deleted_snapshot->>id'
            ? 'snapshotted_duplicate'
            : 'entity_id_tombstone';
        return { data: auditRows[label] ?? null, error: null };
      }
      return { data: recordRows[String(state.value)] ?? null, error: null };
    },
  });
  return builder;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => makeBuilder(table) }),
}));

vi.mock('./queries', () => ({
  createCrmClient: async () => ({
    from: () => ({
      select: () => ({
        is: () => ({
          eq: (_c: string, value: unknown) => ({
            maybeSingle: async () => ({
              data: rlsSees ? { id: value } : null,
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { resolveRecordOrMergeDestination } from './resolve-record';

beforeEach(() => {
  eqCalls = [];
  auditRows = {};
  recordRows = {};
  rlsSees = false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('resolveRecordOrMergeDestination — uuid columns (PI-2)', () => {
  it('never sends a non-uuid segment to a uuid column', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await resolveRecordOrMergeDestination('not-a-uuid', ORG_ID);

    expect(result).toEqual({ kind: 'missing' });
    // The whole point: no query at all, so nothing can raise
    // `invalid input syntax for type uuid`.
    expect(eqCalls).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it.each([
    ['a bare word', 'contacts'],
    ['a trailing-slash artefact', ''],
    ['a uuid with a suffix', `${KEEPER}x`],
    ['a path traversal attempt', '../../etc/passwd'],
    ['a sql-ish payload', "1' OR '1'='1"],
  ])('returns missing without querying for %s', async (_label, segment) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await resolveRecordOrMergeDestination(segment, ORG_ID)).toEqual({ kind: 'missing' });
    expect(eqCalls).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('still resolves a live record the viewer can see', async () => {
    rlsSees = true;
    expect(await resolveRecordOrMergeDestination(KEEPER, ORG_ID)).toEqual({
      kind: 'found',
      recordId: KEEPER,
    });
  });

  it('still follows the merge chain for a real uuid, tombstone probe included', async () => {
    auditRows.diff_deleted_id = { diff: { kept_id: KEEPER }, created_at: '2026-01-02T03:04:05Z' };
    recordRows[KEEPER] = { id: KEEPER, title: 'Wendy Walker' };

    expect(await resolveRecordOrMergeDestination(STALE, ORG_ID)).toEqual({
      kind: 'merged',
      keeperId: KEEPER,
      keeperTitle: 'Wendy Walker',
      mergedAt: '2026-01-02T03:04:05Z',
    });
    // The uuid path is untouched: the entity_id probe is still offered.
    expect(eqCalls.some((c) => c.column === 'entity_id' && c.value === STALE)).toBe(true);
    const auditOrgFilters = eqCalls.filter(
      (c) => c.table === 'crm_audit_log' && c.column === 'org_id' && c.value === ORG_ID,
    );
    expect(auditOrgFilters).toHaveLength(3);
    expect(eqCalls).toContainEqual({
      table: 'crm_records',
      column: 'org_id',
      value: ORG_ID,
    });
  });

  it('stops the walk when an audit diff carries a non-uuid kept_id', async () => {
    // Free-form JSON: a bad historical row can hold anything, and
    // `crm_records.id` is a uuid column.
    auditRows.diff_deleted_id = { diff: { kept_id: 'legacy-zoho-4471' }, created_at: null };

    expect(await resolveRecordOrMergeDestination(STALE, ORG_ID)).toEqual({ kind: 'missing' });
    expect(eqCalls.some((c) => c.table === 'crm_records' && c.value === 'legacy-zoho-4471')).toBe(
      false,
    );
  });
});
