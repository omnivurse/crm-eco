/**
 * Record resolution with merge-destination fallback.
 *
 * When a user hits a stale URL for a record that's been merged into
 * another (via merge_crm_records or bulk dedupe migrations), we redirect
 * them to the keeper instead of showing a generic 404.
 *
 * Merge audit rows store **`entity_id` = keeper id** (see migrations).
 * The merged-away duplicate UUID appears in **`diff.deleted_id`**. Stale
 * bookmarks must therefore resolve via `diff->>'deleted_id'` (primary path).
 * Legacy tombstones keyed by duplicate id as `entity_id` are still supported.
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

type AdminClient = NonNullable<ReturnType<typeof adminClient>>;

/**
 * Finds one merge hop from a stale id `cursor` (usually the deleted duplicate)
 * to `diff.kept_id`. Prefer matching `diff.deleted_id` because merge RPC
 * and bulk migrations log `entity_id` as the keeper, not the duplicate.
 */
async function findMergeHopFromAudit(
  admin: AdminClient,
  cursor: string
): Promise<{ mergedAt: string | null; keeperId: string } | null> {
  let auditRow: { diff: unknown; created_at?: string | null } | null = null;

  const primary = await admin
    .from('crm_audit_log')
    .select('diff, created_at')
    .eq('entity', 'record')
    .eq('action', 'merge')
    .eq('diff->>deleted_id', cursor)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (primary.error) {
    console.error('[resolve-record] audit primary:', primary.error.message);
  }
  auditRow = primary.data ?? null;

  if (!auditRow) {
    const legacy = await admin
      .from('crm_audit_log')
      .select('diff, created_at')
      .eq('entity', 'record')
      .eq('action', 'merge')
      .eq('entity_id', cursor)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacy.error) {
      console.error('[resolve-record] audit legacy:', legacy.error.message);
    }
    auditRow = legacy.data ?? null;
  }

  if (!auditRow) return null;

  const diff = (auditRow.diff ?? {}) as Record<string, unknown>;
  const keptId = typeof diff.kept_id === 'string' ? diff.kept_id : null;
  if (!keptId || keptId === cursor) return null;

  return {
    keeperId: keptId,
    mergedAt: (auditRow.created_at as string | undefined) ?? null,
  };
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

  // Walk the merge chain: A merged → B merged → C ⇒ stale URL for A lands on C.
  let cursor = recordId;
  let lastMergedAt: string | null = null;

  for (let hop = 0; hop < 10; hop++) {
    const hopResult = await findMergeHopFromAudit(admin, cursor);
    if (!hopResult) break;

    cursor = hopResult.keeperId;
    if (hopResult.mergedAt) lastMergedAt = hopResult.mergedAt;

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
    // Keeper row gone — likely merged again; resolve next hop via deleted_id = cursor.
  }

  return { kind: 'missing' };
}
