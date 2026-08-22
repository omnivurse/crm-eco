/**
 * Entity Reupload orchestrator (CRM trickle update).
 *
 * Interface: dry-run | apply over pre-normalized rows.
 * Match order default: zoho_id → email → phone → name_dob.
 * Unmatched rows are ignored (never inserted). Ambiguous keys fail closed.
 */

import { applyHouseholdCsvRules } from '@/lib/crm/household-age';
import {
  buildNormalizedRecordWrite,
  normalizeDateColumnValue,
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

/** `crm_records.title` is derived from these together. */
const NAME_CONTEXT_KEYS: readonly string[] = [
  'first_name',
  'last_name',
  'preferred_name',
];

/** The status mirror reads these in priority order (module-dependent). */
const STATUS_CONTEXT_KEYS: readonly string[] = [
  'status',
  'lead_status',
  'contact_status',
];

/**
 * Indexed columns that `mergeCrmDataJsonIntoRowColumns` can DERIVE from a
 * different JSONB key (start_date → original_start_date, end_date →
 * cancellation_date, sharing_entity → market_type / carrier_id). Each
 * derivation is guarded on "target key absent from the patch", which a
 * changed-keys-only patch trivially satisfies — so they must be suppressed
 * explicitly for records that already carry a value.
 */
const DERIVED_MIRROR_KEYS: readonly string[] = [
  'original_start_date',
  'current_year_start_date',
  'cancellation_date',
  'market_type',
  'carrier_id',
];

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
  /** Row version at lookup time — the write guards on it (see applyUpdate). */
  updated_at: string | null;
}

/** A phone-lookup candidate: which requested phone produced which record. */
export interface PhoneCandidate {
  /** The digit-only phone from the file that this candidate was found for. */
  phone: string;
  /** May be a TRUNCATED projection (the phone RPC returns a `data` stub). */
  record: MatchableRecord;
  /**
   * The lookup hit its result cap for this phone, so other holders of the
   * number may exist but were never returned. The orchestrator fails such a
   * phone closed — an unseen co-holder would otherwise slip past the
   * ambiguity gate and let one person's row be written onto another's record.
   */
  saturated?: boolean;
}

/**
 * Lookup adapter — prod: Supabase; tests: in-memory.
 * Each method returns every candidate so the orchestrator can detect ambiguity.
 *
 * `findByPhones` returns loose CANDIDATES tagged with the requested phone that
 * produced them; the records may be truncated projections (the phone RPC
 * returns a `data` stub, not the full blob). The orchestrator re-fetches every
 * candidate through `findByIds` and verifies the phone against the FULL row
 * before matching — merging into a stub and writing it back would silently
 * delete every field the stub omitted, and grouping on stub fields made the
 * ambiguity gate blind to candidates whose number lives in a field the stub
 * does not carry. `findByIds` must return full rows and exclude soft-deleted
 * records; an id it does not return is treated as unmatched.
 */
export interface RecordLookup {
  findByZohoIds(ids: string[]): Promise<MatchableRecord[]>;
  findByEmails(emails: string[]): Promise<MatchableRecord[]>;
  findByPhones(phones: string[]): Promise<PhoneCandidate[]>;
  findByNameDobs(nameDobKeys: string[]): Promise<MatchableRecord[]>;
  findByIds(ids: string[]): Promise<MatchableRecord[]>;
}

export interface CsvUpdateWriteTarget {
  recordId: string;
  patch: Record<string, unknown>;
  delta: UpdatePayload['delta'];
  matchedBy: MatchKey;
  matchValue: string;
  rowIndex: number;
  /**
   * Before/after images for the keys this row touches — the restore source
   * for `fn_rollback_csv_update`. Written BEFORE the update so a crash can
   * never leave an applied change with no way back.
   */
  beforePatch: { data: Record<string, unknown>; columns: Record<string, unknown> };
  appliedPatch: { data: Record<string, unknown>; columns: Record<string, unknown> };
  /**
   * `updated_at` of the record when it was matched. The writer must apply the
   * patch only if the row still carries this version; anything else means a
   * human (or another job) edited the record after the snapshot was read, and
   * blob-level `data` replacement would silently revert their edit.
   */
  expectedUpdatedAt: string | null;
}

export interface CsvUpdateWriter {
  createJob(input: {
    totalRows: number;
    fileName: string | null;
  }): Promise<{ id: string }>;
  applyUpdate(
    target: CsvUpdateWriteTarget,
  ): Promise<
    | { ok: true }
    | { ok: false; conflict: true; error?: undefined }
    | { ok: false; conflict?: false; error: string }
  >;
  completeJob(input: {
    jobId: string;
    updated: number;
    errorCount: number;
    skippedCount: number;
    writeAttemptCount: number;
    conflictCount: number;
    auditFailureCount: number;
    /**
     * The file is not finished — rows remain to be written on a resume pass.
     * Progress must still be recorded, but the job must NOT be given a
     * terminal status or the history claims a partial run completed.
     */
    paused: boolean;
  }): Promise<void>;
  audit(input: {
    jobId: string;
    target: CsvUpdateWriteTarget;
  }): Promise<{ ok: boolean }>;
  /**
   * Persist the before-image for one row. Called BEFORE `applyUpdate`, and a
   * failure here ABORTS that row's write — an un-revertable update is worse
   * than a skipped one. Returns the ledger row id so the outcome can be
   * stamped afterwards.
   */
  recordLedgerEntry(input: {
    jobId: string;
    target: CsvUpdateWriteTarget;
  }): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  /**
   * Mark a ledger row's final outcome. A failure here means a record was
   * changed but its ledger row still reads 'pending', which rollback skips —
   * i.e. that record silently became un-undoable, so the caller surfaces it.
   */
  finalizeLedgerEntry(input: {
    ledgerId: string;
    status: 'updated' | 'skipped' | 'error';
    error?: string;
  }): Promise<{ ok: boolean; error?: string }>;
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

/** Multiple file rows resolved to the SAME record — all skipped (fail closed). */
export interface DuplicateTargetPreview {
  rowIndex: number;
  recordId: string;
  recordTitle: string | null;
  rowsInFile: number;
}

/** The record changed between match and write — skipped, safe to re-run. */
export interface ConflictPreview {
  rowIndex: number;
  recordId: string;
  recordTitle: string | null;
}

/** The CRM edited this record after the file was exported — applied anyway,
 *  but surfaced so the operator reviews those deltas before trusting them. */
export interface CrmNewerPreview {
  rowIndex: number;
  recordId: string;
  recordTitle: string | null;
  fileModified: string;
  recordUpdated: string;
}

export interface CsvUpdateResult {
  dryRun: boolean;
  totalRows: number;
  matched: number;
  updated: number;
  unmatched: number;
  unchanged: number;
  ambiguous: number;
  /** Rows skipped because another row in the same file targets the same record. */
  duplicateTarget: number;
  /** Apply-time skips: the record was edited after the dry-run snapshot. */
  conflicts: number;
  /** Count of unapplicable cells skipped across all matched rows (bad dates,
   *  non-numeric strings over stored numbers, scalars over arrays). */
  invalidValues: number;
  /** Rows whose record was edited in the CRM after the file's Modified Time.
   *  Still applied — informational, so stale-export deltas get reviewed. */
  crmNewer: number;
  /**
   * Rows that still need writing because the apply stopped at its time
   * budget (or crashed). Re-post the SAME file with these indices and the
   * returned jobId to finish. Empty means the run is complete.
   */
  remainingRowIndices: number[];
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
  previewDuplicateTarget: DuplicateTargetPreview[];
  previewConflicts: ConflictPreview[];
  previewCrmNewer: CrmNewerPreview[];
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
  /**
   * Emit EVERY matched row and EVERY changed field in `previewMatches`
   * instead of the 10-row / 5-field on-screen sample. Only for the streaming
   * delta export — a 14k-row delta is ~10 MB, well over the JSON response cap.
   */
  fullDelta?: boolean;
  /**
   * Resumable apply. The whole file is ALWAYS re-sent and re-resolved, so
   * file-wide guarantees (duplicate-target and ambiguity fail-closed) hold on
   * every pass; only these row indices are written. Omit on the first pass.
   *
   * Splitting a file into independent chunks would break those guarantees:
   * two rows targeting one record in different chunks would each look unique
   * and both write, silently blending two people into one record.
   */
  resumeRowIndices?: number[];
  /** Reuse an existing job row instead of creating one (resume passes). */
  jobId?: string;
  /** Counts already recorded by earlier passes, folded into the final job row. */
  carryOver?: {
    updated: number;
    errorCount: number;
    writeAttemptCount: number;
    conflictCount: number;
    auditFailureCount: number;
  };
  /**
   * Stop writing after this many ms and report the rest as remaining. Keeps a
   * large apply inside the platform's function ceiling: a hard kill leaves a
   * partially-applied file with no record of where it stopped.
   */
  applyBudgetMs?: number;
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
    // Three-step, fail-closed:
    //   1. loose candidates from the lookup (RPC substring hits, stub data);
    //   2. full-row re-fetch — the stub cannot be a merge base (its missing
    //      keys would be DELETED by the blob write) and cannot be trusted for
    //      grouping (its missing phone fields hid real candidates from the
    //      ambiguity gate — e.g. a spouse sharing the number in home_phone);
    //   3. verify the requested digits against the FULL row (exact or
    //      tail-10) before grouping. Unverifiable or vanished candidates are
    //      dropped; two verified candidates for one phone are ambiguous.
    const candidates = await input.lookup.findByPhones(phones);
    const candidateIds = Array.from(
      new Set(candidates.map((c) => c.record.id)),
    );
    const fullRows =
      candidateIds.length > 0 ? await input.lookup.findByIds(candidateIds) : [];
    const fullById = new Map(fullRows.map((r) => [r.id, r]));

    const verifiedByPhone = new Map<string, MatchableRecord[]>();
    const saturatedPhones = new Set<string>();
    const seenPair = new Set<string>();
    for (const { phone, record, saturated } of candidates) {
      if (saturated) saturatedPhones.add(phone);
      const full = fullById.get(record.id);
      if (!full) continue; // trashed / hidden since the RPC ran
      if (!recordMatchesPhone(full, phone)) continue;
      const pairKey = `${phone}|${full.id}`;
      if (seenPair.has(pairKey)) continue;
      seenPair.add(pairKey);
      const list = verifiedByPhone.get(phone);
      if (list) list.push(full);
      else verifiedByPhone.set(phone, [full]);
    }

    for (const row of unresolvedForPhone) {
      const phone = row.keys.phone!;
      const verified = uniqueById(verifiedByPhone.get(phone) ?? []);
      if (saturatedPhones.has(phone)) {
        // Cap reached: an unseen co-holder of this number may exist, so a
        // "unique" verification here cannot be trusted.
        markAmbiguous(
          ambiguousRows,
          row,
          'phone',
          phone,
          Math.max(verified.length, 2),
        );
        continue;
      }
      if (verified.length === 0) continue;
      if (verified.length > 1) {
        markAmbiguous(ambiguousRows, row, 'phone', phone, verified.length);
        continue;
      }
      resolutions.set(row.index, {
        record: verified[0],
        matchedBy: 'phone',
        matchValue: phone,
      });
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
    }
  }

  // --- duplicate targets fail closed ---------------------------------------
  // Two file rows resolving to one record (same key twice, or different keys —
  // e.g. household members sharing an email) would write sequentially from the
  // SAME pre-run snapshot: the later row's blob write silently reverts the
  // earlier row's changes. Skip every such row and report them.
  const rowsByRecordId = new Map<string, number[]>();
  for (const [rowIndex, res] of resolutions) {
    const list = rowsByRecordId.get(res.record.id);
    if (list) list.push(rowIndex);
    else rowsByRecordId.set(res.record.id, [rowIndex]);
  }
  const duplicateTargetRows = new Map<number, DuplicateTargetPreview>();
  for (const [recordId, rowIdxs] of rowsByRecordId) {
    if (rowIdxs.length <= 1) continue;
    for (const rowIndex of rowIdxs) {
      const res = resolutions.get(rowIndex)!;
      duplicateTargetRows.set(rowIndex, {
        rowIndex,
        recordId,
        recordTitle: res.record.title,
        rowsInFile: rowIdxs.length,
      });
      resolutions.delete(rowIndex);
    }
  }

  const matchSummary = {
    byZohoId: 0,
    byEmail: 0,
    byPhone: 0,
    byNameDob: 0,
  };
  for (const res of resolutions.values()) {
    if (res.matchedBy === 'zoho_id') matchSummary.byZohoId++;
    else if (res.matchedBy === 'email') matchSummary.byEmail++;
    else if (res.matchedBy === 'phone') matchSummary.byPhone++;
    else matchSummary.byNameDob++;
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
  const previewDuplicateTarget: DuplicateTargetPreview[] = Array.from(
    duplicateTargetRows.values(),
  ).slice(0, 10);
  const previewConflicts: ConflictPreview[] = [];
  const previewCrmNewer: CrmNewerPreview[] = [];
  const errors: Array<{ rowIndex: number; error: string }> = [];
  let unchanged = 0;
  let invalidValues = 0;
  let conflicts = 0;
  let crmNewer = 0;

  for (const row of updateRows) {
    if (ambiguousRows.has(row.index)) continue;
    if (duplicateTargetRows.has(row.index)) continue;

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
    invalidValues += payload.invalidKeys.length;

    const hasColumnChange = Object.keys(payload.columns).length > 0;
    const hasJsonChange =
      Object.keys(payload.delta).length > 0 ||
      JSON.stringify(payload.mergedData) !==
        JSON.stringify(resolution.record.data || {});

    if (!hasColumnChange && !hasJsonChange) {
      unchanged++;
      continue;
    }

    // Informational stale-export flag: this record was edited in the CRM
    // after the file was exported (date-level compare, so timezone drift in
    // the export's Modified Time cannot false-positive a same-day edit).
    // Still applied — a catch-up file is EXPECTED to be older than the CRM —
    // but surfaced so those deltas get reviewed instead of trusted blindly.
    const fileModified = parseFileModifiedDate(row.normalized);
    const recordUpdated = resolution.record.updated_at?.slice(0, 10) ?? null;
    if (fileModified && recordUpdated && recordUpdated > fileModified) {
      crmNewer++;
      if (previewCrmNewer.length < 10) {
        previewCrmNewer.push({
          rowIndex: row.index,
          recordId: resolution.record.id,
          recordTitle: resolution.record.title,
          fileModified,
          recordUpdated,
        });
      }
    }

    // `fullDelta` powers the downloadable review export: every matched row,
    // every changed field. The 10-row / 5-field caps exist to keep the JSON
    // response inside the platform's non-streaming body limit, so they only
    // apply to the on-screen sample.
    if (input.fullDelta || previewMatches.length < 10) {
      const limitedDelta: MatchPreview['fieldDelta'] = {};
      const entries = input.fullDelta
        ? Object.entries(payload.delta)
        : Object.entries(payload.delta).slice(0, 5);
      for (const [k, v] of entries) {
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
    updateRows.length -
    resolutions.size -
    ambiguousRows.size -
    duplicateTargetRows.size;

  if (input.dryRun) {
    return {
      dryRun: true,
      totalRows: updateRows.length,
      matched: resolutions.size,
      updated: 0,
      unmatched,
      unchanged,
      ambiguous: ambiguousRows.size,
      duplicateTarget: duplicateTargetRows.size,
      conflicts: 0,
      invalidValues,
      crmNewer,
      errors,
      matchSummary,
      previewMatches,
      previewUnmatched,
      previewAmbiguous,
      previewDuplicateTarget,
      previewConflicts,
      previewCrmNewer,
      remainingRowIndices: [],
    };
  }

  if (!input.writer) {
    throw new Error('CsvUpdateWriter is required when dryRun is false');
  }

  const writer = input.writer;
  const importJob = input.jobId
    ? { id: input.jobId }
    : await writer.createJob({
        totalRows: updateRows.length,
        fileName: input.fileName ?? null,
      });

  // On a resume pass, write only the rows that are still outstanding — but
  // note `writes` was built from a FULL re-resolution above, so duplicate and
  // ambiguity fail-closed decisions are identical to the first pass.
  const resumeSet = input.resumeRowIndices
    ? new Set(input.resumeRowIndices)
    : null;
  const pending = resumeSet
    ? writes.filter((w) => resumeSet.has(w.row.index))
    : writes;

  const applyBudgetMs = input.applyBudgetMs ?? 35_000;
  const applyStartedAt = Date.now();
  const remainingRowIndices: number[] = [];

  let updated = 0;
  let auditFailures = 0;
  // Rows actually ATTEMPTED, not planned — a crash midway must not report the
  // whole plan as processed in the job history.
  let attempted = 0;
  let cursor = 0;
  try {
    for (; cursor < pending.length; cursor++) {
      const { row, resolution, payload } = pending[cursor];
      // Stop cleanly before the platform kills the function. A hard kill
      // leaves rows written with no record of which ones.
      if (
        cursor > 0 &&
        Date.now() - applyStartedAt > applyBudgetMs
      ) {
        for (let j = cursor; j < pending.length; j++) {
          remainingRowIndices.push(pending[j].row.index);
        }
        break;
      }
      attempted++;
      // Sanitize + mirror ONLY the keys this row actually changed. Running
      // the FULL merged blob through the write-path normalizer nulled legacy
      // date-ish values in keys the CSV never touched (invisible in delta,
      // preview, and audit) and re-mirrored stale legacy JSONB onto indexed
      // columns. Patch semantics — present keys = touched — match every
      // other crm_records write path (record-patch-service).
      const existingData = (resolution.record.data ?? {}) as Record<
        string,
        unknown
      >;
      const changedKeys = payload.changedDataKeys;
      const changedPatch: Record<string, unknown> = {};
      for (const key of changedKeys) {
        changedPatch[key] = payload.mergedData[key];
      }
      // Some derivations read SIBLING keys and mis-fire when those siblings
      // are missing. Seed them from the STORED blob so the derivation sees
      // what a whole-record write would see, without handing the sanitizer
      // unrelated stored values to rewrite.
      const seedContext = (
        trigger: readonly string[],
        context: readonly string[] = trigger,
      ) => {
        if (!changedKeys.some((k) => trigger.includes(k))) return;
        for (const k of context) {
          if (changedPatch[k] === undefined && existingData[k] !== undefined) {
            changedPatch[k] = existingData[k];
          }
        }
      };
      // title = preferred/first/last combined.
      seedContext(NAME_CONTEXT_KEYS);
      // Status ordering: `lead_status` must stay visible or a file carrying
      // only contact_status re-opens a converted lead. Seed ONLY that key —
      // `d.status` is applied LAST by the mirror, so seeding a stale stored
      // `status` would override the very change the file just made and leave
      // the indexed column behind (list says one thing, record says another).
      seedContext(STATUS_CONTEXT_KEYS, ['lead_status']);
      // Household slots: keep "Yes - 45"-style markers out of the Spouse /
      // Child Name boxes (route them to <slot>_age / has_spouse / has_kids)
      // and carry the recorded-on date in the write itself, so the rollback
      // ledger holds the previous date instead of the trigger re-stamping it.
      applyHouseholdCsvRules(changedPatch, existingData, {
        fileModifiedIso: parseFileModifiedDate(row.normalized),
        todayIso: new Date().toISOString().slice(0, 10),
      });

      const norm = buildNormalizedRecordWrite(changedPatch, {
        moduleKey: input.moduleKey,
        previousTitle: resolution.record.title,
      });
      // The file IS the authoritative status writer when it carries a
      // status-ish column (Status / Lead Status / Contact Status) — allow
      // the module-aware status mirror through so the indexed column and
      // JSONB cannot drift apart (lists vs record detail).
      const csvOwnsStatus = STATUS_CONTEXT_KEYS.some(
        (k) => (row.normalized[k] ?? '').trim().length > 0,
      );
      // Derived mirrors (start_date → original_start_date, end_date →
      // cancellation_date, sharing_entity → market_type/carrier_id) fire only
      // when their TARGET key is absent from the patch. A changed-keys patch
      // omits unchanged keys, so a record that already carries one of these
      // would have it silently recomputed and overwritten — on the very
      // columns the activation/cancellation crons read. Mirror a derived
      // column only when the file changed it outright, or the record has no
      // stored value for it (matching whole-record semantics).
      const derivedExclude = DERIVED_MIRROR_KEYS.filter(
        (k) => !changedKeys.includes(k) && existingData[k] !== undefined,
      );
      const allowKeys: string[] = [];
      if (csvOwnsStatus) allowKeys.push('status');
      // A name part changed but the file has no Name column: let the derived
      // title through, or the heading/lists/search keep the old name forever.
      // (`payload.columns` owns title when the file DOES carry a name column.)
      if (
        changedKeys.some((k) => NAME_CONTEXT_KEYS.includes(k)) &&
        payload.columns.title === undefined
      ) {
        allowKeys.push('title');
      }
      const mirroredColumns = pickUpdateMirrorColumns(
        norm.columns,
        ['title', 'email', 'phone', ...derivedExclude],
        allowKeys,
      );
      // payload.columns may include status/stage (CSV-authoritative when non-empty).
      const patch: Record<string, unknown> = {
        ...mirroredColumns,
        ...payload.columns,
        data: { ...((resolution.record.data ?? {}) as Record<string, unknown>), ...norm.data },
        updated_at: new Date().toISOString(),
      };

      // Before-images: the prior value of exactly the keys this write
      // touches, plus what we are about to write, so a rollback can restore
      // key-by-key and skip anything a human changed afterwards.
      const beforeData: Record<string, unknown> = {};
      const appliedData: Record<string, unknown> = {};
      for (const key of Object.keys(norm.data)) {
        beforeData[key] = existingData[key] ?? null;
        appliedData[key] = norm.data[key];
      }
      const beforeColumns: Record<string, unknown> = {};
      const appliedColumns: Record<string, unknown> = {};
      for (const key of Object.keys(patch)) {
        if (key === 'data' || key === 'updated_at') continue;
        beforeColumns[key] =
          (resolution.record as unknown as Record<string, unknown>)[key] ?? null;
        appliedColumns[key] = patch[key];
      }

      const target: CsvUpdateWriteTarget = {
        recordId: resolution.record.id,
        patch,
        delta: payload.delta,
        matchedBy: resolution.matchedBy,
        matchValue: resolution.matchValue,
        rowIndex: row.index,
        expectedUpdatedAt: resolution.record.updated_at,
        beforePatch: { data: beforeData, columns: beforeColumns },
        appliedPatch: { data: appliedData, columns: appliedColumns },
      };

      // Ledger FIRST. If the before-image cannot be stored, do not perform an
      // update that could never be undone.
      const ledger = await writer.recordLedgerEntry({
        jobId: importJob.id,
        target,
      });
      if (!ledger.ok) {
        errors.push({
          rowIndex: row.index,
          error: `Skipped — could not record an undo entry: ${ledger.error}`,
        });
        continue;
      }

      const result = await writer.applyUpdate(target);
      if (!result.ok) {
        await writer.finalizeLedgerEntry({
          ledgerId: ledger.id,
          status: result.conflict ? 'skipped' : 'error',
          error: result.conflict ? undefined : result.error,
        });
        if (result.conflict) {
          // The record changed (or vanished) while this run was writing.
          // Skipping is the safe outcome — a re-run re-reads and re-diffs
          // against the new state. Not an error: nothing was lost.
          conflicts++;
          if (previewConflicts.length < 10) {
            previewConflicts.push({
              rowIndex: row.index,
              recordId: resolution.record.id,
              recordTitle: resolution.record.title,
            });
          }
          continue;
        }
        errors.push({ rowIndex: row.index, error: result.error });
        continue;
      }
      updated++;
      const stamped = await writer.finalizeLedgerEntry({
        ledgerId: ledger.id,
        status: 'updated',
      });
      if (stamped?.ok === false) {
        errors.push({
          rowIndex: row.index,
          error:
            'Updated, but its undo entry could not be finalised — this record ' +
            'will NOT be restored by an undo of this run.',
        });
      }
      const auditResult = await writer.audit({ jobId: importJob.id, target });
      if (!auditResult.ok) auditFailures++;
    }
  } catch (err) {
    // A thrown error (network, adapter crash) must not strand the job in
    // 'processing' — record it, mark everything not yet attempted as
    // remaining so it can be resumed, and fall through.
    errors.push({
      rowIndex: -1,
      error: err instanceof Error ? err.message : 'apply crashed mid-run',
    });
    // Include the row that threw, not just the ones after it. Whether its
    // write landed is unknown, and dropping it would leave a possibly-applied
    // change with a 'pending' ledger row that rollback ignores — an
    // un-undoable edit. Re-attempting is safe: expectedUpdatedAt was captured
    // before the write, so if it DID land the guard reports a conflict and
    // skips rather than writing twice.
    for (let j = cursor; j < pending.length; j++) {
      remainingRowIndices.push(pending[j].row.index);
    }
  } finally {
    // Always record progress; only stamp a TERMINAL status once the whole
    // file is done, so a paused or crashed run neither claims completion nor
    // strands the job with no counts.
    const carry = input.carryOver;
    await writer.completeJob({
      jobId: importJob.id,
      updated: updated + (carry?.updated ?? 0),
      errorCount: errors.length + (carry?.errorCount ?? 0),
      skippedCount:
        unchanged +
        unmatched +
        ambiguousRows.size +
        duplicateTargetRows.size +
        conflicts +
        (carry?.conflictCount ?? 0),
      writeAttemptCount: attempted + (carry?.writeAttemptCount ?? 0),
      conflictCount: conflicts + (carry?.conflictCount ?? 0),
      auditFailureCount: auditFailures + (carry?.auditFailureCount ?? 0),
      paused: remainingRowIndices.length > 0,
    });
  }

  return {
    dryRun: false,
    totalRows: updateRows.length,
    matched: resolutions.size,
    updated,
    unmatched,
    unchanged,
    ambiguous: ambiguousRows.size,
    duplicateTarget: duplicateTargetRows.size,
    conflicts,
    invalidValues,
    crmNewer,
    errors,
    matchSummary,
    previewMatches,
    previewUnmatched,
    previewAmbiguous,
    previewDuplicateTarget,
    previewConflicts,
    previewCrmNewer,
    remainingRowIndices,
    jobId: importJob.id,
  };
}

/**
 * Date-level parse of the export's own "Modified Time" column (Zoho exports
 * carry one; `Modified Time` → `modified_time` via header canonicalization).
 * Returns null when the file has no such column or the value is unparseable
 * — the stale-file flag then simply cannot fire.
 */
function parseFileModifiedDate(
  normalized: Record<string, string>,
): string | null {
  const raw =
    normalized.modified_time ||
    normalized.last_modified_time ||
    normalized.last_modified ||
    '';
  if (!raw) return null;
  const datePart = raw.trim().split(/[\sT]/)[0] ?? '';
  return normalizeDateColumnValue(datePart);
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

/**
 * Every field a phone number can live in on a full record. Must cover at
 * least the set the `crm_phone_lookup` RPC searches (phone column + data
 * phone / mobile / work_phone / home_phone / cell) — a field the RPC
 * searches but verification cannot see would make real candidates invisible
 * to the ambiguity gate.
 */
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
  push(data.work_phone);
  push(data.home_phone);
  push(data.phone2);
  push(data.mobile_2);
  return Array.from(out);
}

/**
 * Strict phone verification against a FULL record: the requested digits must
 * equal one of the record's numbers exactly, or share an exact 10-digit tail
 * (country-code drift: "13035551212" ↔ "3035551212"). Numbers under 10
 * digits match exactly only — looser matching on short numbers is how a
 * wrong-person update sneaks past the ambiguity gate.
 */
function recordMatchesPhone(rec: MatchableRecord, requested: string): boolean {
  for (const digits of collectPhoneDigits(rec)) {
    if (digits === requested) return true;
    if (
      digits.length >= 10 &&
      requested.length >= 10 &&
      digits.slice(-10) === requested.slice(-10)
    ) {
      return true;
    }
  }
  return false;
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
