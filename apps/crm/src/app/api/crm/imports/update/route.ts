/**
 * POST /api/crm/imports/update
 * ---------------------------------------------------------------------------
 * Apply a Zoho-style "trickle update" CSV to existing CRM records.
 *
 * - Matches each CSV row to a record by `zoho_id` → `email` → `phone`
 *   (configurable). Phone matching is digit-only via `crm_phone_lookup`.
 * - Updates ONLY matched records. Records not present in the CSV are
 *   never touched. Empty CSV cells never overwrite existing values
 *   unless the caller opts in with `overwriteEmpty: true`.
 * - Has a `dryRun` mode (default behavior on first call from the UI) that
 *   returns match counts + a 10-row preview without writing anything.
 *
 * Authz: requires a CRM admin or manager. Defense-in-depth `org_id` filters
 * are added on top of RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  buildUpdatePayload,
  extractMatchKeys,
  MAX_CSV_ROWS,
  planMatches,
  type UpdateRow,
} from '@/lib/imports/csv-update';
import type { CrmRecord } from '@/lib/crm/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const matchKeyEnum = z.enum(['zoho_id', 'email', 'phone']);

const requestSchema = z.object({
  /** Module key the records live in (`contacts`, `leads`, `members`, …). */
  moduleKey: z.string().min(1),
  /** Already-parsed CSV rows: { canonicalField: rawValue, … }. */
  rows: z
    .array(
      z.object({
        index: z.number().int().min(0),
        raw: z.record(z.string(), z.string()),
        normalized: z.record(z.string(), z.string()),
      }),
    )
    .min(1)
    .max(MAX_CSV_ROWS),
  /** Match priority order. Default = best practice. */
  matchPriority: z
    .array(matchKeyEnum)
    .min(1)
    .default(['zoho_id', 'email', 'phone']),
  /** True = preview only. False = perform writes. */
  dryRun: z.boolean().default(true),
  /** True = blank CSV cells overwrite existing values (rare). */
  overwriteEmpty: z.boolean().default(false),
  /** For audit log + import-job tracking. */
  fileName: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Response shape (kept small + serializable)
// ---------------------------------------------------------------------------

interface MatchPreview {
  rowIndex: number;
  matchedBy: 'zoho_id' | 'email' | 'phone';
  matchValue: string;
  recordId: string;
  recordTitle: string | null;
  /** Truncated to first 5 changed fields per row to keep response small. */
  fieldDelta: Record<string, { from: unknown; to: unknown }>;
}

interface UnmatchedPreview {
  rowIndex: number;
  keys: { zoho_id?: string; email?: string; phone?: string };
}

interface UpdateResponse {
  dryRun: boolean;
  totalRows: number;
  matched: number;
  updated: number;
  unmatched: number;
  unchanged: number;
  errors: Array<{ rowIndex: number; error: string }>;
  matchSummary: { byZohoId: number; byEmail: number; byPhone: number };
  previewMatches: MatchPreview[];
  previewUnmatched: UnmatchedPreview[];
  jobId?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const orgId = profile.organization_id;
  const { rows, moduleKey, matchPriority, dryRun, overwriteEmpty, fileName } =
    parsed.data;

  // -------------------------------------------------------------------------
  // 1. Resolve module
  // -------------------------------------------------------------------------
  const { data: moduleRow, error: moduleErr } = await supabase
    .from('crm_modules')
    .select('id, key, name')
    .eq('org_id', orgId)
    .eq('key', moduleKey)
    .maybeSingle();

  if (moduleErr) {
    return NextResponse.json({ error: moduleErr.message }, { status: 500 });
  }
  if (!moduleRow) {
    return NextResponse.json(
      { error: `Module "${moduleKey}" not found in your organization` },
      { status: 404 },
    );
  }

  // -------------------------------------------------------------------------
  // 2. Re-derive match keys server-side. Don't trust client to have done it.
  // -------------------------------------------------------------------------
  const updateRows: UpdateRow[] = rows.map((r) => ({
    index: r.index,
    raw: r.raw,
    normalized: r.normalized,
    keys: extractMatchKeys(r.normalized),
  }));

  // Filter the match plan by the priority list. Rows that have no key in any
  // of the allowed priority slots end up unmatched.
  for (const row of updateRows) {
    const filteredKeys: typeof row.keys = {};
    for (const slot of matchPriority) {
      if (row.keys[slot]) {
        filteredKeys[slot] = row.keys[slot];
        break;
      }
    }
    row.keys = filteredKeys;
  }

  const plan = planMatches(updateRows);

  // -------------------------------------------------------------------------
  // 3. Resolve matches in batches.
  //
  //    Each row is matched at most once: if zoho_id finds a hit, email/phone
  //    are not consulted. The priority is enforced by emptying the row's
  //    other keys after a successful match (see `markMatched`).
  // -------------------------------------------------------------------------
  type Resolution = {
    record: Pick<
      CrmRecord,
      'id' | 'title' | 'email' | 'phone' | 'status' | 'stage' | 'data'
    >;
    matchedBy: 'zoho_id' | 'email' | 'phone';
    matchValue: string;
  };
  const resolutions = new Map<number, Resolution>();
  const matchSummary = { byZohoId: 0, byEmail: 0, byPhone: 0 };

  // 3a. Zoho ID
  if (plan.zohoIds.length > 0 && matchPriority.includes('zoho_id')) {
    const { data, error } = await supabase
      .from('crm_records')
      .select('id, title, email, phone, status, stage, data')
      .eq('org_id', orgId)
      .eq('module_id', moduleRow.id)
      .in('data->>zoho_id', plan.zohoIds);
    if (error && error.code !== 'PGRST204') {
      return NextResponse.json(
        { error: `zoho_id lookup failed: ${error.message}` },
        { status: 500 },
      );
    }
    for (const rec of (data || []) as Resolution['record'][]) {
      const zohoId =
        ((rec.data as Record<string, unknown>) || {}).zoho_id;
      const candidates = plan.byZohoId.get(String(zohoId ?? '')) || [];
      for (const row of candidates) {
        if (resolutions.has(row.index)) continue;
        resolutions.set(row.index, {
          record: rec,
          matchedBy: 'zoho_id',
          matchValue: String(zohoId),
        });
        matchSummary.byZohoId++;
      }
    }
  }

  // 3b. Email — only for rows still unmatched
  const unresolvedAfterZoho = updateRows.filter(
    (r) => !resolutions.has(r.index) && r.keys.email,
  );
  if (unresolvedAfterZoho.length > 0 && matchPriority.includes('email')) {
    const emails = Array.from(
      new Set(unresolvedAfterZoho.map((r) => r.keys.email!.toLowerCase())),
    );
    // PostgREST doesn't support lower(email) in `in()`; fetch and compare in JS.
    const { data, error } = await supabase
      .from('crm_records')
      .select('id, title, email, phone, status, stage, data')
      .eq('org_id', orgId)
      .eq('module_id', moduleRow.id)
      .in('email', dedupeCaseVariants(emails));
    if (error) {
      return NextResponse.json(
        { error: `email lookup failed: ${error.message}` },
        { status: 500 },
      );
    }
    const byEmail = new Map<string, Resolution['record']>();
    for (const rec of (data || []) as Resolution['record'][]) {
      if (rec.email) byEmail.set(rec.email.toLowerCase(), rec);
    }
    for (const row of unresolvedAfterZoho) {
      const rec = byEmail.get(row.keys.email!.toLowerCase());
      if (rec) {
        resolutions.set(row.index, {
          record: rec,
          matchedBy: 'email',
          matchValue: row.keys.email!,
        });
        matchSummary.byEmail++;
      }
    }
  }

  // 3c. Phone — only for rows still unmatched. crm_phone_lookup normalizes
  //     digits across `phone` and the JSONB phone keys.
  const unresolvedAfterEmail = updateRows.filter(
    (r) => !resolutions.has(r.index) && r.keys.phone,
  );
  if (unresolvedAfterEmail.length > 0 && matchPriority.includes('phone')) {
    // Run lookups in parallel but cap concurrency so we don't flood the DB.
    const CONCURRENCY = 8;
    const phones = Array.from(
      new Set(unresolvedAfterEmail.map((r) => r.keys.phone!)),
    );
    const phoneToRecord = new Map<string, Resolution['record']>();

    for (let i = 0; i < phones.length; i += CONCURRENCY) {
      const slice = phones.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map((digits) =>
          supabase.rpc('crm_phone_lookup', {
            p_org_id: orgId,
            p_query: digits,
            p_module_key: moduleKey,
            p_limit: 1,
          }),
        ),
      );
      results.forEach((result, idx) => {
        if (result.error || !Array.isArray(result.data) || result.data.length === 0) return;
        phoneToRecord.set(slice[idx], result.data[0] as Resolution['record']);
      });
    }

    for (const row of unresolvedAfterEmail) {
      const rec = phoneToRecord.get(row.keys.phone!);
      if (rec) {
        resolutions.set(row.index, {
          record: rec,
          matchedBy: 'phone',
          matchValue: row.keys.phone!,
        });
        matchSummary.byPhone++;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Build update payloads + collect previews
  // -------------------------------------------------------------------------
  const writes: Array<{
    row: UpdateRow;
    resolution: Resolution;
    payload: ReturnType<typeof buildUpdatePayload>;
  }> = [];
  const previewMatches: MatchPreview[] = [];
  const previewUnmatched: UnmatchedPreview[] = [];
  const errors: Array<{ rowIndex: number; error: string }> = [];
  let unchanged = 0;

  for (const row of updateRows) {
    const resolution = resolutions.get(row.index);
    if (!resolution) {
      if (previewUnmatched.length < 10) {
        previewUnmatched.push({
          rowIndex: row.index,
          keys: row.keys,
        });
      }
      continue;
    }

    const payload = buildUpdatePayload(resolution.record, row, {
      overwriteEmpty,
    });

    const hasColumnChange = Object.keys(payload.columns).length > 0;
    const hasJsonChange =
      Object.keys(payload.delta).length > 0 ||
      JSON.stringify(payload.mergedData) !==
        JSON.stringify(resolution.record.data || {});

    if (!hasColumnChange && !hasJsonChange) {
      unchanged++;
      continue;
    }

    if (previewMatches.length < 10) {
      const limitedDelta: MatchPreview['fieldDelta'] = {};
      const entries = Object.entries(payload.delta).slice(0, 5);
      for (const [k, v] of entries) limitedDelta[k] = v;
      previewMatches.push({
        rowIndex: row.index,
        matchedBy: resolution.matchedBy,
        matchValue: resolution.matchValue,
        recordId: resolution.record.id,
        recordTitle: resolution.record.title,
        fieldDelta: limitedDelta,
      });
    }

    writes.push({ row, resolution, payload });
  }

  // -------------------------------------------------------------------------
  // 5. Dry run? Return preview without writing.
  // -------------------------------------------------------------------------
  if (dryRun) {
    const response: UpdateResponse = {
      dryRun: true,
      totalRows: updateRows.length,
      matched: resolutions.size,
      updated: 0,
      unmatched: updateRows.length - resolutions.size,
      unchanged,
      errors,
      matchSummary,
      previewMatches,
      previewUnmatched,
    };
    return NextResponse.json(response);
  }

  // -------------------------------------------------------------------------
  // 6. Apply writes — track an import job so the history page surfaces them.
  // -------------------------------------------------------------------------
  const { data: importJob, error: jobErr } = await supabase
    .from('crm_import_jobs')
    .insert({
      org_id: orgId,
      module_id: moduleRow.id,
      source_type: 'csv_update',
      file_name: fileName ?? 'csv-update.csv',
      total_rows: updateRows.length,
      status: 'processing',
      started_at: new Date().toISOString(),
      created_by: profile.id,
      // crm_import_jobs has no module_key column; preserve it inside the
      // JSONB stats field for the history UI / debugging.
      stats: { module_key: moduleKey },
    })
    .select('id')
    .single();

  if (jobErr) {
    return NextResponse.json({ error: jobErr.message }, { status: 500 });
  }

  let updated = 0;
  for (const { row, resolution, payload } of writes) {
    const updatePatch: Record<string, unknown> = {
      ...payload.columns,
      data: payload.mergedData,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase
      .from('crm_records')
      .update(updatePatch)
      .eq('id', resolution.record.id)
      .eq('org_id', orgId);

    if (upErr) {
      errors.push({ rowIndex: row.index, error: upErr.message });
      continue;
    }

    updated++;

    // Audit-log the change. Best-effort — don't fail the whole batch on
    // log insert errors; that's a separate observability concern.
    await supabase
      .from('crm_audit_log')
      .insert({
        org_id: orgId,
        actor_id: profile.id,
        action: 'csv_update',
        entity: 'crm_records',
        entity_id: resolution.record.id,
        diff: payload.delta,
        meta: {
          job_id: importJob.id,
          matched_by: resolution.matchedBy,
          match_value: resolution.matchValue,
          file_name: fileName ?? null,
          row_index: row.index,
        },
      })
      .then(({ error }) => {
        if (error) console.warn('[csv-update] audit log insert failed:', error.message);
      });
  }

  await supabase
    .from('crm_import_jobs')
    .update({
      status: errors.length === writes.length ? 'failed' : 'completed',
      processed_rows: writes.length,
      // CSV update jobs only update existing records — use updated_count.
      updated_count: updated,
      error_count: errors.length,
      skipped_count: unchanged + (updateRows.length - resolutions.size),
      completed_at: new Date().toISOString(),
    })
    .eq('id', importJob.id);

  const response: UpdateResponse = {
    dryRun: false,
    totalRows: updateRows.length,
    matched: resolutions.size,
    updated,
    unmatched: updateRows.length - resolutions.size,
    unchanged,
    errors,
    matchSummary,
    previewMatches,
    previewUnmatched,
    jobId: importJob.id,
  };
  return NextResponse.json(response);
}

/**
 * `email` is stored mixed-case in `crm_records`. PostgREST `.in()` is exact
 * match — to give us a fighting chance of finding "WENDY@..." stored as
 * "wendy@..." we send both lower and original spellings. The JS-side
 * post-filter is then case-insensitive.
 */
function dedupeCaseVariants(emails: string[]): string[] {
  const out = new Set<string>();
  for (const e of emails) {
    out.add(e);
    out.add(e.toLowerCase());
    out.add(e.toUpperCase());
  }
  return Array.from(out);
}
