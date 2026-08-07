/**
 * Supabase adapters for the Entity Reupload orchestrator.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { nameDobKey } from './csv-update';
import { summarizeImportJobCompletion } from './import-job-status';
import { DedupLookupError, fetchAllForDedup } from './paged-lookup';
import type {
  CsvUpdateWriteTarget,
  CsvUpdateWriter,
  MatchableRecord,
  RecordLookup,
} from './run-csv-update';

const RECORD_SELECT =
  'id, title, email, phone, status, stage, data' as const;

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
      return fetchAllForDedup<MatchableRecord>('email', (from, to) =>
        supabase
          .from('crm_records')
          .select(RECORD_SELECT)
          .eq('org_id', orgId)
          .eq('module_id', moduleId)
          .in('email', dedupeCaseVariants(emails))
          .order('id', { ascending: true })
          .range(from, to),
      );
    },

    async findByPhones(phones) {
      if (phones.length === 0) return [];
      const CONCURRENCY = 8;
      // Ask for more than 1 so ambiguity is visible (fail closed upstream).
      const PHONE_LIMIT = 5;
      const out: MatchableRecord[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < phones.length; i += CONCURRENCY) {
        const slice = phones.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          slice.map((digits) =>
            supabase.rpc('crm_phone_lookup', {
              p_org_id: orgId,
              p_query: digits,
              p_module_key: moduleKey,
              p_limit: PHONE_LIMIT,
            }),
          ),
        );
        for (const result of results) {
          if (result.error || !Array.isArray(result.data)) continue;
          for (const row of result.data) {
            const rec = row as MatchableRecord;
            if (!rec?.id || seen.has(rec.id)) continue;
            seen.add(rec.id);
            out.push(rec);
          }
        }
      }
      return out;
    },

    async findByNameDobs(nameDobKeys) {
      if (nameDobKeys.length === 0) return [];
      // Fetch candidates that have DOB in JSONB for this module, then filter in JS
      // with the same normalize rules as extractMatchKeys. Paged: an unbounded
      // select silently stops at db.max_rows, which would make records past the
      // first page look unmatched and silently skip their updates.
      const data = await fetchAllForDedup<MatchableRecord>('name_dob', (from, to) =>
        supabase
          .from('crm_records')
          .select(RECORD_SELECT)
          .eq('org_id', orgId)
          .eq('module_id', moduleId)
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
          stats: { module_key: moduleKey },
        })
        .select('id')
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create import job');
      }
      return { id: data.id as string };
    },

    async applyUpdate(target: CsvUpdateWriteTarget) {
      const { error } = await supabase
        .from('crm_records')
        .update(target.patch)
        .eq('id', target.recordId)
        .eq('org_id', orgId);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    },

    async completeJob({
      jobId,
      updated,
      errorCount,
      skippedCount,
      writeAttemptCount,
    }) {
      // Three terminal states, not two. The previous rule marked a run 'failed'
      // ONLY when every write failed, so 999 failures out of 1000 reported
      // 'completed' and nobody noticed.
      //
      // Requires migration 202608030002 (adds 'completed_with_errors' to the
      // crm_import_jobs.status CHECK). That migration must be applied BEFORE
      // this code deploys, or the update violates the constraint and the job is
      // stranded in 'processing'.
      const completion = summarizeImportJobCompletion(errorCount, writeAttemptCount);

      await supabase
        .from('crm_import_jobs')
        .update({
          status: completion.status,
          processed_rows: writeAttemptCount,
          updated_count: updated,
          error_count: errorCount,
          skipped_count: skippedCount,
          error_message: completion.errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('org_id', orgId);
    },

    async audit({ jobId, target }) {
      const { error } = await supabase.from('crm_audit_log').insert({
        org_id: orgId,
        actor_id: actorId,
        action: 'csv_update',
        entity: 'crm_records',
        entity_id: target.recordId,
        diff: target.delta,
        meta: {
          job_id: jobId,
          matched_by: target.matchedBy,
          match_value: target.matchValue,
          row_index: target.rowIndex,
        },
      });
      if (error) {
        console.warn('[csv-update] audit log insert failed:', error.message);
      }
    },
  };
}

function dedupeCaseVariants(emails: string[]): string[] {
  const out = new Set<string>();
  for (const e of emails) {
    out.add(e);
    out.add(e.toLowerCase());
    out.add(e.toUpperCase());
  }
  return Array.from(out);
}
