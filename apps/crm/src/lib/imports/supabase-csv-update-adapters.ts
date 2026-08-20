/**
 * Supabase adapters for the Entity Reupload orchestrator.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { nameDobKey } from './csv-update';
import { DedupLookupError, fetchAllForDedup } from './paged-lookup';
import type {
  CsvUpdateWriteTarget,
  CsvUpdateWriter,
  MatchableRecord,
  PhoneCandidate,
  RecordLookup,
} from './run-csv-update';

const RECORD_SELECT =
  'id, title, email, phone, status, stage, data, updated_at' as const;

/** Batch size for `.in(...)` / `.or(...)` key lists so URLs stay bounded. */
const KEY_CHUNK = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

const BS = '\\';

/**
 * Escape a literal value for use inside a PostgREST `.or()` quoted ilike
 * pattern. TWO layers unwrap before Postgres sees the pattern: PostgREST
 * un-escapes `\<char>` → `<char>` inside a quoted value, then LIKE interprets
 * `%` / `_` as wildcards and `\` as its escape character. So a literal `_`
 * (common in emails) must arrive at LIKE as `\_`, which means emitting `\\_`
 * here; a literal backslash needs `\\\\`. Single-escaping left `_` live as a
 * single-char wildcard, widening the candidate set.
 */
function escapeIlikeValue(value: string): string {
  return value.replace(/[\\%_"]/g, (ch) => {
    if (ch === '\\') return BS.repeat(4);
    if (ch === '"') return BS + '"';
    return BS.repeat(2) + ch;
  });
}

export function createSupabaseRecordLookup(input: {
  supabase: SupabaseClient;
  orgId: string;
  moduleId: string;
  moduleKey: string;
}): RecordLookup {
  const { supabase, orgId, moduleId, moduleKey } = input;

  return {
    async findByZohoIds(ids) {
      if (ids.length === 0) return [];
      // Paged: an unbounded select silently stops at db.max_rows, and a
      // truncated match set makes existing records look unmatched — the update
      // is then skipped rather than applied.
      try {
        return await fetchAllForDedup<MatchableRecord>('zoho_id', (from, to) =>
          supabase
            .from('crm_records')
            .select(RECORD_SELECT)
            .eq('org_id', orgId)
            .eq('module_id', moduleId)
            .is('deleted_at', null)
            .in('data->>zoho_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        );
      } catch (err) {
        // PGRST204 was tolerated here before paging; keep that behaviour so a
        // module without zoho_id still falls through to the email/phone/name
        // matchers instead of failing the whole run.
        if (err instanceof DedupLookupError && err.code === 'PGRST204') return [];
        throw err;
      }
    },

    async findByEmails(emails) {
      if (emails.length === 0) return [];
      // Case-insensitive: `ilike` with LIKE metacharacters escaped, so the
      // pattern is exact-but-caseless equality. The previous
      // `.in('email', [lower, UPPER])` missed every mixed-case stored email
      // ("John.Smith@Gmail.com"), silently reporting those rows unmatched.
      // The orchestrator additionally groups by exact lowercased equality,
      // so even an over-fetch could be ignored, never mis-matched.
      const out: MatchableRecord[] = [];
      for (const batch of chunk(emails, KEY_CHUNK)) {
        const orFilter = batch
          .map((e) => `email.ilike."${escapeIlikeValue(e)}"`)
          .join(',');
        const rows = await fetchAllForDedup<MatchableRecord>(
          'email',
          (from, to) =>
            supabase
              .from('crm_records')
              .select(RECORD_SELECT)
              .eq('org_id', orgId)
              .eq('module_id', moduleId)
              .is('deleted_at', null)
              .or(orFilter)
              .order('id', { ascending: true })
              .range(from, to),
        );
        out.push(...rows);
      }
      return out;
    },

    async findByPhones(phones) {
      if (phones.length === 0) return [];
      // CANDIDATES ONLY: crm_phone_lookup projects a small `data` stub, not
      // the full JSONB blob. The orchestrator re-fetches every candidate via
      // findByIds and verifies the number against the FULL row — these rows
      // must never be used as a merge base or for grouping decisions.
      //
      // An 11+-digit file number also queries its 10-digit tail: the RPC's
      // JSONB branch is substring-only, so "13035551212" cannot find a
      // stored "303-555-1212" without the tail query. Both queries report
      // under the ORIGINAL requested phone; the orchestrator's exact/tail-10
      // verification keeps the extra candidates honest.
      const CONCURRENCY = 8;
      // Well above any realistic number of holders of one number, so hitting
      // it means the result set was truncated — reported as `saturated` so the
      // orchestrator fails that phone closed rather than trusting a
      // "unique" match that simply out-ranked the rows it never saw.
      const PHONE_LIMIT = 25;
      const queries: Array<{ phone: string; q: string }> = [];
      for (const p of phones) {
        queries.push({ phone: p, q: p });
        if (p.length > 10) queries.push({ phone: p, q: p.slice(-10) });
      }

      const out: PhoneCandidate[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < queries.length; i += CONCURRENCY) {
        const slice = queries.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          slice.map(({ q }) =>
            supabase.rpc('crm_phone_lookup', {
              p_org_id: orgId,
              p_query: q,
              p_module_key: moduleKey,
              p_limit: PHONE_LIMIT,
            }),
          ),
        );
        results.forEach((result, idx) => {
          const phone = slice[idx].phone;
          // Never swallow: a failed lookup would silently report every row
          // using this number as "unmatched" and drop its update, which is
          // indistinguishable from "no such record" (same stance as
          // fetchAllForDedup).
          if (result.error) {
            throw new DedupLookupError(
              'phone',
              result.error.message,
              result.error.code,
            );
          }
          if (!Array.isArray(result.data)) return;
          const saturated = result.data.length >= PHONE_LIMIT;
          for (const row of result.data) {
            const rec = row as MatchableRecord;
            if (!rec?.id) continue;
            const pairKey = `${phone}|${rec.id}`;
            if (seen.has(pairKey)) continue;
            seen.add(pairKey);
            out.push({ phone, record: rec, saturated });
          }
        });
      }
      return out;
    },

    async findByNameDobs(nameDobKeys) {
      if (nameDobKeys.length === 0) return [];

      // Preferred path: match keys in SQL against an expression index. The
      // fallback below pages EVERY record in the module that has a DOB and
      // rebuilds keys in JS — correct, but on a 30k-row module it is the
      // slowest tier and the most likely to exhaust the function budget.
      // PAGED. PostgREST caps an unbounded response at db.max_rows (1000 for
      // this project) and does so SILENTLY — a truncated candidate set would
      // hide the second holder of a name+DOB key and let the ambiguity gate
      // pass a match it should have refused. Same fail-closed stance as
      // fetchAllForDedup.
      const probe = await supabase.rpc('crm_name_dob_lookup', {
        p_org_id: orgId,
        p_module_id: moduleId,
        p_keys: nameDobKeys,
      }).range(0, 0);
      if (!probe.error) {
        const rows = await fetchAllForDedup<Record<string, unknown>>(
          'name_dob_rpc',
          (from, to) =>
            supabase
              .rpc('crm_name_dob_lookup', {
                p_org_id: orgId,
                p_module_id: moduleId,
                p_keys: nameDobKeys,
              })
              .range(from, to),
        );
        return rows.map((row) =>
          Object.assign({}, row, {
            nameDobKey: row.name_dob_key as string,
          }) as unknown as MatchableRecord & { nameDobKey: string },
        );
      }
      const viaRpc = probe;
      // PGRST202 = function not in the schema cache, i.e. the migration has
      // not been applied yet. Any other error is a real failure and must not
      // be masked by a silent full scan.
      if (viaRpc.error && viaRpc.error.code !== 'PGRST202') {
        throw new DedupLookupError(
          'name_dob',
          viaRpc.error.message,
          viaRpc.error.code,
        );
      }

      const data = await fetchAllForDedup<MatchableRecord>('name_dob', (from, to) =>
        supabase
          .from('crm_records')
          .select(RECORD_SELECT)
          .eq('org_id', orgId)
          .eq('module_id', moduleId)
          .is('deleted_at', null)
          .not('data->>date_of_birth', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
      );

      const wanted = new Set(nameDobKeys);
      const matched: MatchableRecord[] = [];
      for (const rec of data) {
        const d = (rec.data || {}) as Record<string, unknown>;
        const key = nameDobKey(d.first_name, d.last_name, d.date_of_birth);
        if (key && wanted.has(key)) {
          matched.push(
            Object.assign(rec, { nameDobKey: key }) as MatchableRecord & {
              nameDobKey: string;
            },
          );
        }
      }
      return matched;
    },

    async findByIds(ids) {
      if (ids.length === 0) return [];
      const out: MatchableRecord[] = [];
      for (const batch of chunk(ids, KEY_CHUNK)) {
        const rows = await fetchAllForDedup<MatchableRecord>(
          'by_id',
          (from, to) =>
            supabase
              .from('crm_records')
              .select(RECORD_SELECT)
              .eq('org_id', orgId)
              .eq('module_id', moduleId)
              .is('deleted_at', null)
              .in('id', batch)
              .order('id', { ascending: true })
              .range(from, to),
        );
        out.push(...rows);
      }
      return out;
    },
  };
}

export function createSupabaseCsvUpdateWriter(input: {
  supabase: SupabaseClient;
  orgId: string;
  moduleId: string;
  moduleKey: string;
  actorId: string;
}): CsvUpdateWriter {
  const { supabase, orgId, moduleId, moduleKey, actorId } = input;

  return {
    async createJob({ totalRows, fileName }) {
      const { data, error } = await supabase
        .from('crm_import_jobs')
        .insert({
          org_id: orgId,
          module_id: moduleId,
          source_type: 'csv_update',
          file_name: fileName ?? 'csv-update.csv',
          total_rows: totalRows,
          status: 'processing',
          started_at: new Date().toISOString(),
          created_by: actorId,
          // Deliberately false at creation. can_rollback advertises "this job
          // has before-images"; a job that ends up writing nothing has none,
          // and an Undo button on it would promise a restore it cannot do.
          // completeJob flips it once rows have actually been written.
          can_rollback: false,
          stats: { module_key: moduleKey },
        })
        .select('id')
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create import job');
      }
      return { id: data.id as string };
    },

    async recordLedgerEntry({ jobId, target }) {
      // `match_type` keeps to the values crm_import_rows_match_type_check
      // allows; the CSV matcher's own key goes in match_key. zoho_id/email are
      // exact identifiers; phone/name+DOB are heuristics.
      const matchType =
        target.matchedBy === 'zoho_id' || target.matchedBy === 'email'
          ? 'exact_match'
          : 'fuzzy_match';
      const { data, error } = await supabase
        .from('crm_import_rows')
        .insert({
          job_id: jobId,
          row_index: target.rowIndex,
          record_id: target.recordId,
          status: 'pending',
          match_type: matchType,
          match_key: target.matchedBy,
          before_patch: target.beforePatch,
          applied_patch: target.appliedPatch,
          record_updated_at_before: target.expectedUpdatedAt,
        })
        .select('id')
        .single();
      if (error || !data) {
        // PGRST204 = column not in the schema cache, i.e. the ledger migration
        // has not been applied yet. Deploy order should be DB-then-app, but if
        // the app lands first this must not take the whole CSV-update path
        // down — every row would abort with "could not record an undo entry".
        // Degrade to the pre-ledger behaviour and let the run proceed
        // WITHOUT undo, the same way the name+DOB RPC falls back.
        if (error?.code === 'PGRST204') {
          console.warn(
            '[csv-update] rollback ledger columns missing — applying WITHOUT undo support. Apply migration 20260820140000.',
          );
          return { ok: true as const, id: '' };
        }
        return {
          ok: false as const,
          error: error?.message ?? 'no ledger row returned',
        };
      }
      return { ok: true as const, id: data.id as string };
    },

    async finalizeLedgerEntry({ ledgerId, status, error: rowError }) {
      // Empty id = the ledger is unavailable (see recordLedgerEntry); there is
      // nothing to stamp and the run is already known to be undo-less.
      if (!ledgerId) return { ok: true as const };
      const { error } = await supabase
        .from('crm_import_rows')
        .update({ status, error: rowError ?? null })
        .eq('id', ledgerId);
      if (error) {
        // The write already happened, so the record HAS changed but its
        // ledger row still says 'pending' — and rollback only restores
        // 'updated' rows. That silently makes this record un-undoable, which
        // the operator must be told about, not just the server log.
        console.warn('[csv-update] ledger finalize failed:', error.message);
        return { ok: false as const, error: error.message };
      }
      return { ok: true as const };
    },

    async applyUpdate(target: CsvUpdateWriteTarget) {
      // Optimistic-concurrency guard: the patch REPLACES the `data` blob, so
      // it must only land on the exact row version the diff was computed
      // against. `.select('id')` makes "0 rows updated" observable — that
      // means the record was edited (or trashed) after the snapshot, and the
      // safe outcome is to skip and let a re-run re-diff.
      let query = supabase
        .from('crm_records')
        .update(target.patch)
        .eq('id', target.recordId)
        .eq('org_id', orgId)
        .is('deleted_at', null);
      query =
        target.expectedUpdatedAt === null
          ? query.is('updated_at', null)
          : query.eq('updated_at', target.expectedUpdatedAt);
      const { data, error } = await query.select('id');
      if (error) return { ok: false as const, error: error.message };
      if (!data || data.length === 0) {
        // 0 rows can mean a mid-run edit OR an RLS policy that denies this
        // user the write. Probe to tell them apart — reporting a permission
        // failure as a benign "edited mid-run" would send the operator into
        // an endless re-run loop.
        const { data: probe } = await supabase
          .from('crm_records')
          .select('id, updated_at, deleted_at')
          .eq('id', target.recordId)
          .eq('org_id', orgId)
          .maybeSingle();
        if (
          probe &&
          probe.deleted_at === null &&
          String(probe.updated_at) === String(target.expectedUpdatedAt)
        ) {
          return {
            ok: false as const,
            error:
              'Update blocked — the record is visible but not writable ' +
              '(row-level security / permissions)',
          };
        }
        return { ok: false as const, conflict: true as const };
      }
      return { ok: true as const };
    },

    async completeJob({
      jobId,
      updated,
      errorCount,
      skippedCount,
      writeAttemptCount,
      conflictCount,
      auditFailureCount,
      paused,
    }) {
      // Three terminal states, not two. The previous rule marked a run 'failed'
      // ONLY when every write failed, so 999 failures out of 1000 reported
      // 'completed' and nobody noticed.
      //
      // Requires migration 20260804110101_import_job_partial_failure_status
      // (adds 'completed_with_errors' to the crm_import_jobs.status CHECK).
      // That migration must be applied BEFORE this code deploys, or the update
      // violates the constraint and the job is stranded in 'processing'.
      // A paused run keeps 'processing': rows remain to be written, and the
      // import history must not show a half-applied file as finished.
      const status = paused
        ? 'processing'
        : errorCount === 0
          ? 'completed'
          : errorCount === writeAttemptCount && writeAttemptCount > 0
            ? 'failed'
            : 'completed_with_errors';

      const { error } = await supabase
        .from('crm_import_jobs')
        .update({
          status,
          // Only now is it true: at least one row was written with a
          // before-image, so fn_rollback_csv_update has something to restore.
          can_rollback: updated > 0,
          processed_rows: writeAttemptCount,
          updated_count: updated,
          error_count: errorCount,
          skipped_count: skippedCount,
          error_message:
            errorCount > 0
              ? `${errorCount} of ${writeAttemptCount} row(s) failed to write`
              : null,
          completed_at: paused ? null : new Date().toISOString(),
          stats: {
            module_key: moduleKey,
            conflict_count: conflictCount,
            audit_failure_count: auditFailureCount,
            paused,
          },
        })
        .eq('id', jobId)
        .eq('org_id', orgId);
      if (error) {
        // A job stuck in 'processing' misleads the import history — make the
        // cause findable in logs even though the run itself succeeded.
        console.warn('[csv-update] completeJob update failed:', error.message);
      }
    },

    async audit({ jobId, target }) {
      // action MUST be a value in crm_audit_log_action_check — the previous
      // 'csv_update' is not, so every one of these inserts was silently
      // rejected by the CHECK constraint. 'import' is in the allowed list,
      // is semantically right, and avoids pairing with the crm_records
      // AFTER-UPDATE trigger row (action 'update') as a duplicate "Updated
      // record" timeline entry. The precise source lives in meta.
      const { error } = await supabase.from('crm_audit_log').insert({
        org_id: orgId,
        actor_id: actorId,
        action: 'import',
        entity: 'crm_records',
        entity_id: target.recordId,
        diff: target.delta,
        meta: {
          source: 'csv_update',
          job_id: jobId,
          matched_by: target.matchedBy,
          match_value: target.matchValue,
          row_index: target.rowIndex,
        },
      });
      if (error) {
        console.warn('[csv-update] audit log insert failed:', error.message);
        return { ok: false };
      }
      return { ok: true };
    },
  };
}
