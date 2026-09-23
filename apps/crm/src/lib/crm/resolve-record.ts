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
    // A soft-deleted (e.g. merged-away) record must NOT count as "exists" — it's
    // hidden everywhere else, so the caller should fall through to the audit log
    // and redirect a stale URL to the surviving keeper.
    .is('deleted_at' as never, null)
    .eq('id', recordId)
    .maybeSingle();
  if (error) return false;
  return !!data?.id;
}

/**
 * Read the audit log with service-role credentials. Every query must carry
 * the authenticated caller's organization because service-role access
 * bypasses RLS and record ids alone are not an authorization boundary.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PI-2 — `crm_records.id` and `crm_audit_log.entity_id` are `uuid` columns, so
 * Postgres does not merely fail to match a non-uuid comparand: it ABORTS the
 * statement with `invalid input syntax for type uuid`. `/crm/r/<segment>` puts
 * a raw URL segment in front of those columns, so every typo'd or scanned-bot
 * record URL used to raise a server error that `next dev` forwarded straight
 * into the browser console.
 *
 * The guard is a filter, not a swallow: a value that cannot be a uuid cannot be
 * a record id either, so skipping the query loses no result. The JSONB probes
 * (`diff->>deleted_id`, `diff->deleted_snapshot->>id`) compare TEXT and are
 * left alone — they are safe with any input, and audit diffs are the one place
 * a non-uuid id could legitimately have been recorded.
 */
function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
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
  cursor: string,
  organizationId: string
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
        .eq('org_id', organizationId)
        .eq('diff->>deleted_id', c)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    },
    // `entity_id` is a uuid column — see isUuid(). Only ask when the cursor
    // could be one; otherwise this single query aborts and takes its
    // console.error with it, while the two JSONB probes still run.
    ...(isUuid(cursor)
      ? [
          {
            label: 'entity_id_tombstone',
            builder: admin
              .from('crm_audit_log')
              .select('diff, created_at')
              .in('entity', ['record', 'crm_records'])
              .eq('action', 'merge')
              .eq('org_id', organizationId)
              .eq('entity_id', cursor)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          },
        ]
      : []),
    {
      label: 'snapshotted_duplicate',
      builder: admin
        .from('crm_audit_log')
        .select('diff, created_at')
        .in('entity', ['record', 'crm_records'])
        .eq('action', 'merge')
        .eq('org_id', organizationId)
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
  recordId: string,
  organizationId: string
): Promise<ResolveRecordResult> {
  if (!recordId || !isUuid(organizationId)) return { kind: 'missing' };
  // A segment that is not a uuid is not a record id and never was one, so
  // there is nothing for the audit walk to find. Returning here keeps the raw
  // segment away from every uuid column at once (PI-2).
  if (!isUuid(recordId)) return { kind: 'missing' };

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
    const hopResult = await findMergeHopFromAudit(admin, cursor, organizationId);
    if (!hopResult) break;

    cursor = hopResult.keeperId;
    if (hopResult.mergedAt) lastMergedAt = hopResult.mergedAt;

    // `kept_id` comes out of an audit diff, which is free-form JSON — a bad
    // historical row could hold anything. `crm_records.id` is a uuid column.
    if (!isUuid(cursor)) break;

    const { data: keeper } = await admin
      .from('crm_records')
      .select('id, title')
      .eq('id', cursor)
      .eq('org_id', organizationId)
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
