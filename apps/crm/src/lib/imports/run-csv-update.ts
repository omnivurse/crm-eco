/**
 * Entity Reupload orchestrator (CRM trickle update).
 *
 * Interface: dry-run | apply over pre-normalized rows.
 * Match order default: zoho_id → email → phone → name_dob.
 * Unmatched rows are ignored (never inserted). Ambiguous keys fail closed.
 */

import {
  buildNormalizedRecordWrite,
  pickUpdateMirrorColumns,
} from '@/lib/crm/merge-crm-data-json-to-row';
import {
  buildUpdatePayload,
  DEFAULT_MATCH_PRIORITY,
  extractMatchKeys,
  filterKeysByPriority,
  nameDobKey,
  planMatches,
  type MatchKey,
  type UpdatePayload,
  type UpdateRow,
} from './csv-update';

// ---------------------------------------------------------------------------
// Adapters at the lookup / write seam
// ---------------------------------------------------------------------------

export interface MatchableRecord {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  stage: string | null;
  data: Record<string, unknown> | null;
}

/**
 * Lookup adapter — prod: Supabase; tests: in-memory.
 * Each method returns every candidate so the orchestrator can detect ambiguity.
 */
export interface RecordLookup {
  findByZohoIds(ids: string[]): Promise<MatchableRecord[]>;
  findByEmails(emails: string[]): Promise<MatchableRecord[]>;
  findByPhones(phones: string[]): Promise<MatchableRecord[]>;
  findByNameDobs(nameDobKeys: string[]): Promise<MatchableRecord[]>;
}

export interface CsvUpdateWriteTarget {
  recordId: string;
  patch: Record<string, unknown>;
  delta: UpdatePayload['delta'];
  matchedBy: MatchKey;
  matchValue: string;
  rowIndex: number;
}

export interface CsvUpdateWriter {
  createJob(input: {
    totalRows: number;
    fileName: string | null;
  }): Promise<{ id: string }>;
  applyUpdate(target: CsvUpdateWriteTarget): Promise<{ ok: true } | { ok: false; error: string }>;
  completeJob(input: {
    jobId: string;
    updated: number;
    errorCount: number;
    skippedCount: number;
    writeAttemptCount: number;
  }): Promise<void>;
  audit(input: {
    jobId: string;
    target: CsvUpdateWriteTarget;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Result shape (HTTP-serializable)
// ---------------------------------------------------------------------------

export interface MatchPreview {
  rowIndex: number;
  matchedBy: MatchKey;
  matchValue: string;
  recordId: string;
  recordTitle: string | null;
  fieldDelta: Record<string, { from: unknown; to: unknown }>;
}

export interface UnmatchedPreview {
  rowIndex: number;
  keys: UpdateRow['keys'];
}

export interface AmbiguousPreview {
  rowIndex: number;
  matchedBy: MatchKey;
  matchValue: string;
  candidateCount: number;
}

export interface CsvUpdateResult {
  dryRun: boolean;
  totalRows: number;
  matched: number;
  updated: number;
  unmatched: number;
  unchanged: number;
  ambiguous: number;
  errors: Array<{ rowIndex: number; error: string }>;
  matchSummary: {
    byZohoId: number;
    byEmail: number;
    byPhone: number;
    byNameDob: number;
  };
  previewMatches: MatchPreview[];
  previewUnmatched: UnmatchedPreview[];
  previewAmbiguous: AmbiguousPreview[];
  jobId?: string;
}

export interface RunCsvUpdateInput {
  rows: Array<{
    index: number;
    raw: Record<string, string>;
    normalized: Record<string, string>;
  }>;
  moduleKey: string;
  matchPriority?: MatchKey[];
  dryRun: boolean;
  overwriteEmpty?: boolean;
  fileName?: string | null;
  lookup: RecordLookup;
  /** Required when dryRun is false. */
  writer?: CsvUpdateWriter;
}

type Resolution = {
  record: MatchableRecord;
  matchedBy: MatchKey;
  matchValue: string;
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runCsvUpdate(
  input: RunCsvUpdateInput,
): Promise<CsvUpdateResult> {
  const matchPriority = input.matchPriority?.length
    ? input.matchPriority
    : DEFAULT_MATCH_PRIORITY;
  const overwriteEmpty = input.overwriteEmpty ?? false;

  const updateRows: UpdateRow[] = input.rows.map((r) => ({
    index: r.index,
    raw: r.raw,
    normalized: r.normalized,
    keys: filterKeysByPriority(extractMatchKeys(r.normalized), matchPriority),
  }));

  const plan = planMatches(updateRows);
  const resolutions = new Map<number, Resolution>();
  const ambiguousRows = new Map<number, AmbiguousPreview>();
  const matchSummary = {
    byZohoId: 0,
    byEmail: 0,
    byPhone: 0,
    byNameDob: 0,
  };

  // --- zoho_id ---
  if (plan.zohoIds.length > 0 && matchPriority.includes('zoho_id')) {
    const records = await input.lookup.findByZohoIds(plan.zohoIds);
    const byKey = groupByUniqueOrAmbiguous(records, (rec) => {
      const z = (rec.data || {}).zoho_id;
      return z == null || z === '' ? null : String(z);
    });
    for (const [zohoId, rows] of plan.byZohoId) {
      const bucket = byKey.get(zohoId);
      if (!bucket) continue;
      if (bucket.ambiguous) {
        for (const row of rows) {
          markAmbiguous(ambiguousRows, row, 'zoho_id', zohoId, bucket.count);
        }
        continue;
      }
      for (const row of rows) {
        if (resolutions.has(row.index) || ambiguousRows.has(row.index)) continue;
        resolutions.set(row.index, {
          record: bucket.record!,
          matchedBy: 'zoho_id',
          matchValue: zohoId,
        });
        matchSummary.byZohoId++;
      }
    }
  }

  // --- email ---
  const unresolvedForEmail = updateRows.filter(
    (r) =>
      !resolutions.has(r.index) &&
      !ambiguousRows.has(r.index) &&
      r.keys.email &&
      matchPriority.includes('email'),
  );
  if (unresolvedForEmail.length > 0) {
    const emails = Array.from(
      new Set(unresolvedForEmail.map((r) => r.keys.email!)),
    );
    const records = await input.lookup.findByEmails(emails);
    const byKey = groupByUniqueOrAmbiguous(records, (rec) =>
      rec.email ? rec.email.toLowerCase() : null,
    );
    for (const row of unresolvedForEmail) {
      const email = row.keys.email!;
      const bucket = byKey.get(email);
      if (!bucket) continue;
      if (bucket.ambiguous) {
        markAmbiguous(ambiguousRows, row, 'email', email, bucket.count);
        continue;
      }
      resolutions.set(row.index, {
        record: bucket.record!,
        matchedBy: 'email',
        matchValue: email,
      });
      matchSummary.byEmail++;
    }
  }

  // --- phone ---
  const unresolvedForPhone = updateRows.filter(
    (r) =>
      !resolutions.has(r.index) &&
      !ambiguousRows.has(r.index) &&
      r.keys.phone &&
      matchPriority.includes('phone'),
  );
  if (unresolvedForPhone.length > 0) {
    const phones = Array.from(
      new Set(unresolvedForPhone.map((r) => r.keys.phone!)),
    );
    const records = await input.lookup.findByPhones(phones);
    // Phone lookup returns records; group by digit-normalized phone fields.
    const byKey = groupPhoneRecords(records, phones);
    for (const row of unresolvedForPhone) {
      const phone = row.keys.phone!;
      const bucket = byKey.get(phone);
      if (!bucket) continue;
      if (bucket.ambiguous) {
        markAmbiguous(ambiguousRows, row, 'phone', phone, bucket.count);
        continue;
      }
      resolutions.set(row.index, {
        record: bucket.record!,
        matchedBy: 'phone',
        matchValue: phone,
      });
      matchSummary.byPhone++;
    }
  }

  // --- name + DOB ---
  const unresolvedForNameDob = updateRows.filter(
    (r) =>
      !resolutions.has(r.index) &&
      !ambiguousRows.has(r.index) &&
      r.keys.name_dob &&
      matchPriority.includes('name_dob'),
  );
  if (unresolvedForNameDob.length > 0) {
    const nameDobs = Array.from(
      new Set(unresolvedForNameDob.map((r) => r.keys.name_dob!)),
    );
    const records = await input.lookup.findByNameDobs(nameDobs);
    const byKey = groupByUniqueOrAmbiguous(records, (rec) => {
      const d = (rec.data || {}) as Record<string, unknown>;
      const attached = (rec as MatchableRecord & { nameDobKey?: string })
        .nameDobKey;
      if (attached) return attached;
      return nameDobKey(d.first_name, d.last_name, d.date_of_birth);
    });
    for (const row of unresolvedForNameDob) {
      const key = row.keys.name_dob!;
      const bucket = byKey.get(key);
      if (!bucket) continue;
      if (bucket.ambiguous) {
        markAmbiguous(ambiguousRows, row, 'name_dob', key, bucket.count);
        continue;
      }
      resolutions.set(row.index, {
        record: bucket.record!,
        matchedBy: 'name_dob',
        matchValue: key,
      });
      matchSummary.byNameDob++;
    }
  }

  // --- payloads ---
  const writes: Array<{
    row: UpdateRow;
    resolution: Resolution;
    payload: UpdatePayload;
  }> = [];
  const previewMatches: MatchPreview[] = [];
  const previewUnmatched: UnmatchedPreview[] = [];
  const previewAmbiguous: AmbiguousPreview[] = Array.from(
    ambiguousRows.values(),
  ).slice(0, 10);
  const errors: Array<{ rowIndex: number; error: string }> = [];
  let unchanged = 0;

  for (const row of updateRows) {
    if (ambiguousRows.has(row.index)) continue;

    const resolution = resolutions.get(row.index);
    if (!resolution) {
      if (previewUnmatched.length < 10) {
        previewUnmatched.push({ rowIndex: row.index, keys: row.keys });
      }
      continue;
    }

    const payload = buildUpdatePayload(
      {
        ...resolution.record,
        data: resolution.record.data ?? {},
      },
      row,
      { overwriteEmpty },
    );

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
      for (const [k, v] of Object.entries(payload.delta).slice(0, 5)) {
        limitedDelta[k] = v;
      }
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

  const unmatched =
    updateRows.length - resolutions.size - ambiguousRows.size;

  if (input.dryRun) {
    return {
      dryRun: true,
      totalRows: updateRows.length,
      matched: resolutions.size,
      updated: 0,
      unmatched,
      unchanged,
      ambiguous: ambiguousRows.size,
      errors,
      matchSummary,
      previewMatches,
      previewUnmatched,
      previewAmbiguous,
    };
  }

  if (!input.writer) {
    throw new Error('CsvUpdateWriter is required when dryRun is false');
  }

  const writer = input.writer;
  const importJob = await writer.createJob({
    totalRows: updateRows.length,
    fileName: input.fileName ?? null,
  });

  let updated = 0;
  for (const { row, resolution, payload } of writes) {
    const norm = buildNormalizedRecordWrite(payload.mergedData, {
      moduleKey: input.moduleKey,
      previousTitle: resolution.record.title,
    });
    const mirroredColumns = pickUpdateMirrorColumns(norm.columns, [
      'title',
      'email',
      'phone',
    ]);
    // payload.columns may include status/stage (CSV-authoritative when non-empty).
    const patch: Record<string, unknown> = {
      ...mirroredColumns,
      ...payload.columns,
      data: norm.data,
      updated_at: new Date().toISOString(),
    };

    const target: CsvUpdateWriteTarget = {
      recordId: resolution.record.id,
      patch,
      delta: payload.delta,
      matchedBy: resolution.matchedBy,
      matchValue: resolution.matchValue,
      rowIndex: row.index,
    };

    const result = await writer.applyUpdate(target);
    if (!result.ok) {
      errors.push({ rowIndex: row.index, error: result.error });
      continue;
    }
    updated++;
    await writer.audit({ jobId: importJob.id, target });
  }

  await writer.completeJob({
    jobId: importJob.id,
    updated,
    errorCount: errors.length,
    skippedCount: unchanged + unmatched + ambiguousRows.size,
    writeAttemptCount: writes.length,
  });

  return {
    dryRun: false,
    totalRows: updateRows.length,
    matched: resolutions.size,
    updated,
    unmatched,
    unchanged,
    ambiguous: ambiguousRows.size,
    errors,
    matchSummary,
    previewMatches,
    previewUnmatched,
    previewAmbiguous,
    jobId: importJob.id,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Bucket =
  | { ambiguous: false; record: MatchableRecord; count: 1 }
  | { ambiguous: true; record?: undefined; count: number };

function groupByUniqueOrAmbiguous(
  records: MatchableRecord[],
  keyOf: (rec: MatchableRecord) => string | null,
): Map<string, Bucket> {
  const lists = new Map<string, MatchableRecord[]>();
  for (const rec of records) {
    const key = keyOf(rec);
    if (!key) continue;
    const list = lists.get(key);
    if (list) list.push(rec);
    else lists.set(key, [rec]);
  }
  const out = new Map<string, Bucket>();
  for (const [key, list] of lists) {
    // Deduplicate by record id (same row returned twice).
    const unique = uniqueById(list);
    if (unique.length === 1) {
      out.set(key, { ambiguous: false, record: unique[0], count: 1 });
    } else {
      out.set(key, { ambiguous: true, count: unique.length });
    }
  }
  return out;
}

function groupPhoneRecords(
  records: MatchableRecord[],
  requestedPhones: string[],
): Map<string, Bucket> {
  const requested = new Set(requestedPhones);
  const lists = new Map<string, MatchableRecord[]>();

  for (const rec of records) {
    const digits = collectPhoneDigits(rec);
    for (const d of digits) {
      if (!requested.has(d)) continue;
      const list = lists.get(d);
      if (list) list.push(rec);
      else lists.set(d, [rec]);
    }
  }

  const out = new Map<string, Bucket>();
  for (const [key, list] of lists) {
    const unique = uniqueById(list);
    if (unique.length === 1) {
      out.set(key, { ambiguous: false, record: unique[0], count: 1 });
    } else {
      out.set(key, { ambiguous: true, count: unique.length });
    }
  }
  return out;
}

function collectPhoneDigits(rec: MatchableRecord): string[] {
  const out = new Set<string>();
  const push = (raw: unknown) => {
    if (raw == null) return;
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) out.add(digits);
  };
  push(rec.phone);
  const data = (rec.data || {}) as Record<string, unknown>;
  push(data.phone);
  push(data.mobile);
  push(data.cell);
  push(data.mobile_phone);
  return Array.from(out);
}

function uniqueById(records: MatchableRecord[]): MatchableRecord[] {
  const seen = new Set<string>();
  const out: MatchableRecord[] = [];
  for (const r of records) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function markAmbiguous(
  map: Map<number, AmbiguousPreview>,
  row: UpdateRow,
  matchedBy: MatchKey,
  matchValue: string,
  candidateCount: number,
): void {
  if (map.has(row.index)) return;
  map.set(row.index, {
    rowIndex: row.index,
    matchedBy,
    matchValue,
    candidateCount,
  });
}
