/**
 * Record resolution with merge-destination fallback.
 *
 * When a user hits a stale URL for a record that's been merged into
 * another (via merge_crm_records), we want to automatically redirect
 * them to the keeper instead of slapping them with a generic 404.
 *
 * The merge_crm_records RPC (fixed in migration 202604210007) writes
 * a `crm_audit_log` tombstone row with `entity_id = <deleted_duplicate>`
 * and `action = 'merge'`, so we can ask the audit log "where did this
 * id go?" using the existing (entity, entity_id) index — no JSONB scan.
 *
 * NOTE: audit rows written before 202604210007 do NOT exist — the RPC
 * silently swallowed a CHECK-constraint violation. For those cases
 * this resolver returns `{ kind: 'missing' }` and the calling page
 * shows the regular not-found UI (with the search fallback).
 */

import { createClient } from '@supabase/supabase-js';
import { createCrmClient } from './queries';

export type ResolveRecordResult =
  | {
      kind: 'found';
      recordId: string;
    }
  | {
      kind: 'merged';
      /** The surviving record's id — safe to redirect to. */
      keeperId: string;
      /** For toast UX. Null if the keeper has no title at resolution time. */
      keeperTitle: string | null;
      /** ISO timestamp when the merge happened, for UI context. */
      mergedAt: string | null;
    }
  | {
      kind: 'missing';
    };

/**
 * Check whether a record exists (respecting RLS). We only need to
 * distinguish "exists and visible to this user" from "not returned by
 * RLS". In either case the caller can then check the audit log.
 */
async function recordExistsForUser(recordId: string): Promise<boolean> {
  const supabase = await createCrmClient();
  const { data, error } = await supabase
    .from('crm_records')
    .select('id')
    .eq('id', recordId)
    .maybeSingle();
  if (error) return false;
  return !!data?.id;
}

/**
 * Read the audit log with service-role credentials. The audit log is
 * org-scoped already and we only return data about records the caller
 * either originally had access to (we require an ID they were already
 * trying to open) or will have access to after the redirect (same org
 * is enforced by the merge RPC). No information leak.
 */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function resolveRecordOrMergeDestination(
  recordId: string
): Promise<ResolveRecordResult> {
  if (!recordId) return { kind: 'missing' };

  if (await recordExistsForUser(recordId)) {
    return { kind: 'found', recordId };
  }

  const admin = adminClient();
  if (!admin) return { kind: 'missing' };

  // Walk the merge chain: if A was merged into B and B was merged into C,
  // the user's stale URL for A should end up on C. Cap at 10 hops to
  // defend against any accidental cycle.
  let cursor = recordId;
  let lastMergedAt: string | null = null;
  for (let hop = 0; hop < 10; hop++) {
    const { data: auditRow, error } = await admin
      .from('crm_audit_log')
      .select('diff, created_at')
      .eq('entity', 'record')
      .eq('entity_id', cursor)
      .eq('action', 'merge')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !auditRow) break;

    const diff = (auditRow.diff ?? {}) as Record<string, unknown>;
    const keptId = typeof diff.kept_id === 'string' ? diff.kept_id : null;
    const deletedId = typeof diff.deleted_id === 'string' ? diff.deleted_id : null;

    // If we're looking at the keeper's audit row (entity_id === kept_id
    // === cursor), this record was the keeper — not the one that moved.
    // That means the cursor still exists; if it doesn't exist for the
    // user, it's an RLS issue, not a merge issue. Stop here.
    if (keptId === cursor) break;

    // Otherwise we're on the tombstone row — cursor was the duplicate.
    if (!keptId || keptId === cursor) break;
    lastMergedAt = (auditRow.created_at as string) ?? null;
    cursor = keptId;

    // If the keeper itself still exists, we're done.
    const { data: keeper } = await admin
      .from('crm_records')
      .select('id, title')
      .eq('id', cursor)
      .maybeSingle();

    if (keeper?.id) {
      return {
        kind: 'merged',
        keeperId: keeper.id as string,
        keeperTitle: (keeper.title as string | null) ?? null,
        mergedAt: lastMergedAt,
      };
    }
    // keeper doesn't exist either — follow another hop.
  }

  return { kind: 'missing' };
}
