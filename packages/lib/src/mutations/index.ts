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
// guaranteedUpdateWithVersion — optimistic concurrency for direct supabase-js
//
// Applies the same If-Match guarantee the CRM API uses (`updated_at` token),
// but without requiring callers to route through an API endpoint. Use this
// for any direct browser → Supabase update where two admins / two tabs could
// race on the same row.
//
// Behaviour:
//   - Reads the row's current `updated_at` if not supplied, then runs the
//     update with `WHERE id = X AND updated_at = etag`.
//   - When 0 rows update, the etag drifted (someone else wrote first). We
//     refetch and retry up to `maxRetries` times with exponential backoff.
//   - After the retry budget is spent, returns a CONFLICT result so the UI
//     can surface "this record was just edited — please refresh" instead of
//     silently overwriting the other write.
// ---------------------------------------------------------------------------

export async function guaranteedUpdateWithVersion<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  updates: Record<string, unknown>,
  opts: {
    /** When omitted, the helper fetches the current updated_at first. */
    expectedUpdatedAt?: string | null;
    orgId?: string;
    orgColumn?: string;
    selectColumns?: string;
    maxRetries?: number;
    /** Backoff (ms) per retry attempt. */
    backoffMs?: readonly number[];
  } = {},
): Promise<MutationResult<T>> {
  const orgColumn = opts.orgColumn ?? 'org_id';
  const selectCols = opts.selectColumns ?? '*';
  const maxRetries = opts.maxRetries ?? 3;
  const backoff = opts.backoffMs ?? [50, 200, 500];

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'No fields to update', code: 'EMPTY_UPDATE' };
  }

  let etag = opts.expectedUpdatedAt ?? null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (!etag) {
      const fetchQuery = supabase.from(table).select('updated_at').eq('id', id);
      if (opts.orgId) fetchQuery.eq(orgColumn, opts.orgId);
      const { data: current, error: fetchErr } = await fetchQuery.maybeSingle();
      if (fetchErr) return { ok: false, error: fetchErr.message, code: fetchErr.code };
      if (!current) {
        return {
          ok: false,
          error: 'Record not found',
          code: 'ZERO_ROWS',
          meta: { table, id },
        };
      }
      etag = (current as { updated_at: string | null }).updated_at;
    }

    let query = supabase
      .from(table)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (opts.orgId) query = query.eq(orgColumn, opts.orgId);
    if (etag) query = query.eq('updated_at', etag);

    const { data, error } = await query.select(selectCols).maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        // No row matched the (id, updated_at) pair — version drifted.
        // Fall through to retry with a fresh etag.
        etag = null;
      } else {
        return { ok: false, error: error.message, code: error.code };
      }
    } else if (data) {
      return { ok: true, data: data as T };
    } else {
      // Update returned no rows but no error — version drifted.
      etag = null;
    }

    if (attempt < maxRetries - 1) {
      const wait = backoff[attempt] ?? 500;
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  return {
    ok: false,
    error: 'This record was just edited by someone else — refresh and try again',
    code: 'CONFLICT',
    meta: { table, id },
  };
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
