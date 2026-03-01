/**
 * Guaranteed Save — Shared Mutation Layer
 *
 * Canonical data-mutation helpers that enforce:
 *  1. Strict WHERE (primary key + org scope)
 *  2. Return the updated row (.select().single())
 *  3. Hard-fail on 0 affected rows or error
 *  4. Standard result shape for all consumers
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Result type — every mutation returns this
// ---------------------------------------------------------------------------

export interface MutationOk<T> {
  ok: true;
  data: T;
}

export interface MutationFail {
  ok: false;
  error: string;
  code?: string;
  meta?: Record<string, unknown>;
}

export type MutationResult<T> = MutationOk<T> | MutationFail;

// ---------------------------------------------------------------------------
// guaranteedUpdate — update a single row and confirm persistence
// ---------------------------------------------------------------------------

export async function guaranteedUpdate<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  updates: Record<string, unknown>,
  opts: {
    orgId?: string;
    orgColumn?: string; // defaults to 'org_id'
    selectColumns?: string; // defaults to '*'
  } = {},
): Promise<MutationResult<T>> {
  const orgColumn = opts.orgColumn ?? 'org_id';
  const selectCols = opts.selectColumns ?? '*';

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'No fields to update', code: 'EMPTY_UPDATE' };
  }

  let query = supabase
    .from(table)
    .update(updates)
    .eq('id', id);

  if (opts.orgId) {
    query = query.eq(orgColumn, opts.orgId);
  }

  const { data, error } = await query.select(selectCols).single();

  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    if (error.code === 'PGRST116') {
      return {
        ok: false,
        error: 'Update affected 0 rows — record may not exist or access is denied',
        code: 'ZERO_ROWS',
        meta: { table, id, orgId: opts.orgId },
      };
    }
    return { ok: false, error: error.message, code: error.code };
  }

  if (!data) {
    return {
      ok: false,
      error: 'Update returned no data — row may have been deleted',
      code: 'NO_DATA',
    };
  }

  return { ok: true, data: data as T };
}

// ---------------------------------------------------------------------------
// guaranteedInsert — insert a single row and confirm persistence
// ---------------------------------------------------------------------------

export async function guaranteedInsert<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  opts: {
    selectColumns?: string;
  } = {},
): Promise<MutationResult<T>> {
  const selectCols = opts.selectColumns ?? '*';

  const { data, error } = await supabase
    .from(table)
    .insert(values)
    .select(selectCols)
    .single();

  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }

  if (!data) {
    return { ok: false, error: 'Insert returned no data', code: 'NO_DATA' };
  }

  return { ok: true, data: data as T };
}

// ---------------------------------------------------------------------------
// guaranteedDelete — delete a single row and confirm it existed
// ---------------------------------------------------------------------------

export async function guaranteedDelete(
  supabase: SupabaseClient,
  table: string,
  id: string,
  opts: {
    orgId?: string;
    orgColumn?: string;
  } = {},
): Promise<MutationResult<{ id: string }>> {
  const orgColumn = opts.orgColumn ?? 'org_id';

  let query = supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (opts.orgId) {
    query = query.eq(orgColumn, opts.orgId);
  }

  const { data, error } = await query.select('id').single();

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        ok: false,
        error: 'Delete affected 0 rows — record not found or access denied',
        code: 'ZERO_ROWS',
      };
    }
    return { ok: false, error: error.message, code: error.code };
  }

  if (!data) {
    return { ok: false, error: 'Row not found', code: 'NOT_FOUND' };
  }

  return { ok: true, data: data as { id: string } };
}
