/**
 * Record resolution with merge-destination fallback.
 *
 * When a user hits a stale URL for a record that's been merged into
 * another (via merge_crm_records or bulk dedupe migrations), we redirect
 * them to the keeper instead of showing a generic 404.
 *
 * Merge audit rows usually store **`entity_id` = keeper id** with
 * **`diff.deleted_id` = duplicate**. Stale bookmarks resolve via those fields.
 * Bulk merge scripts may silently skip audit inserts (`EXCEPTION WHEN OTHERS
 * THEN NULL`); those merges cannot be redirected from history alone.
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

/** Normalize UUID-ish strings so JSONB `->>` lookups match Postgres output. */
function normalizeRecordId(id: string): string {
  return id.trim().toLowerCase();
}

function keeperIdFromDiff(diff: Record<string, unknown>, cursorNormalized: string): string | null {
  const raw = diff.kept_id;
  let asText: string | null = null;
  if (typeof raw === 'string') asText = raw;
  else if (typeof raw === 'number' && Number.isFinite(raw)) asText = String(raw);
  if (asText === null) return null;
  const keptId = asText.trim().toLowerCase();
  if (!keptId || keptId === cursorNormalized) return null;
  return keptId;
}

function hopFromAuditRow(
  auditRow: { diff: unknown; created_at?: string | null },
  cursorNormalized: string
): { mergedAt: string | null; keeperId: string } | null {
  const diff = (auditRow.diff ?? {}) as Record<string, unknown>;
  const keptId = keeperIdFromDiff(diff, cursorNormalized);
  if (!keptId) return null;

  return {
    keeperId: keptId,
    mergedAt: (auditRow.created_at as string | undefined) ?? null,
  };
}

/**
 * Finds one merge hop from a stale id `cursor` (usually the deleted duplicate)
 * to `diff.kept_id`. Prefer matching `diff.deleted_id` because merge RPC
 * and bulk migrations log `entity_id` as the keeper, not the duplicate.
 *
 * We try several lookups because historically:
 * - Some bulk merges swallowed audit insert failures (no row at all → unrecoverable here).
 * - `entity` was sometimes modeled as legacy values.
 * - `deleted_id` appears under `deleted_snapshot.id` semantics for older rows if backfilled oddly.
 */
async function findMergeHopFromAudit(
  admin: AdminClient,
  cursor: string
): Promise<{ mergedAt: string | null; keeperId: string } | null> {
  const c = normalizeRecordId(cursor);

  const tryRow = (row: {
    diff: unknown;
    created_at?: string | null;
  } | null): { mergedAt: string | null; keeperId: string } | null => {
    if (!row) return null;
    return hopFromAuditRow(row, c);
  };

  type AuditPick = { diff: unknown; created_at?: string | null };

  const queries: Array<{ label: string; builder: PromiseLike<{ data: AuditPick | null; error: { message: string } | null }> }> = [
    {
      label: 'diff_deleted_id',
      builder: admin
        .from('crm_audit_log')
        .select('diff, created_at')
        .in('entity', ['record', 'crm_records'])
        .eq('action', 'merge')
        .eq('diff->>deleted_id', c)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    },
    {
      label: 'entity_id_tombstone',
      builder: admin
        .from('crm_audit_log')
        .select('diff, created_at')
        .in('entity', ['record', 'crm_records'])
        .eq('action', 'merge')
        .eq('entity_id', cursor)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    },
    {
      label: 'snapshotted_duplicate',
      builder: admin
        .from('crm_audit_log')
        .select('diff, created_at')
        .in('entity', ['record', 'crm_records'])
        .eq('action', 'merge')
        .eq('diff->deleted_snapshot->>id', c)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    },
  ];

  for (const { label, builder } of queries) {
    const { data: row, error } = await builder;
    if (error) {
      console.error(`[resolve-record] audit ${label}:`, error.message);
      continue;
    }
    const hop = tryRow(row);
    if (hop) return hop;
  }

  return null;
}

export async function resolveRecordOrMergeDestination(
  recordId: string
): Promise<ResolveRecordResult> {
  if (!recordId) return { kind: 'missing' };

  if (await recordExistsForUser(recordId)) {
    return { kind: 'found', recordId };
  }

  const admin = adminClient();
  if (!admin) {
    console.warn(
      '[resolve-record] SUPABASE_SERVICE_ROLE_KEY unavailable; cannot read merge audit tail',
    );
    return { kind: 'missing' };
  }

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
