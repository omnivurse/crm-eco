import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { MAX_CSV_ROWS } from '@/lib/imports/csv-update';
import {
  buildNormalizedRecordWrite,
  mergeCrmDataJsonIntoRowColumns,
  pickUpdateMirrorColumns,
  sanitizeCrmDataJsonPatch,
} from '@/lib/crm/merge-crm-data-json-to-row';
import { requireActiveOrgCrmRoles } from '@/lib/crm/require-crm-role';
import { fetchAllForDedup } from '@/lib/imports/paged-lookup';


/**
 * Request schema. This route previously did `const body: ImportRequest = await
 * request.json()` — a bare cast that validated nothing and, critically, put no
 * ceiling on `data.length`. A Next route handler has no default body limit, so
 * a single request could pin the server's memory. Its sibling
 * `POST /api/crm/imports/update` already validated with zod; this matches it,
 * including the shared `MAX_CSV_ROWS` ceiling.
 */
const columnMappingSchema = z.object({
  sourceColumn: z.string(),
  targetField: z.string().nullable(),
});

const importRequestSchema = z.object({
  moduleId: z.string().uuid(),
  organizationId: z.string().uuid(),
  mappings: z.array(columnMappingSchema),
  data: z.array(z.record(z.string(), z.string())).min(1).max(MAX_CSV_ROWS),
  fileName: z.string().optional(),
  /** Optional: save mapping template for reuse. */
  saveMappingAs: z.string().optional(),
  /** Skip records that already exist (by email/phone/name+DOB). */
  skipDuplicates: z.boolean().default(true),
  /**
   * What to do when an incoming row matches an existing record:
   *   - 'skip'   (default) — leave the existing record untouched.
   *   - 'update' — moved to POST /api/crm/imports/update (Entity Reupload);
   *                rejected with 410 below so match/merge logic cannot diverge.
   */
  onDuplicate: z.enum(['skip', 'update']).default('skip'),
});

// ── Market type classification for CSV imports ──
const HEALTHSHARE_PATTERNS = /health\s*share|sharing|ministry|impact|knew\s*health|oneshare|sedera|liberty|zion|aliera|medishare|medi-share|samaritan|mpowering|mpb\b|mpower|jericho|unite\s*health|chr\b/i;
const INSURANCE_CARRIER_PATTERNS = /blue\s*cross|bcbs|aetna|united\s*health|cigna|humana|anthem|kaiser|molina|centene|oscar|ambetter|caresource|coventry|wellcare|bright\s*health|clover/i;
const INSURANCE_PRODUCT_PATTERNS = /\bhmo\b|\bppo\b|\bepo\b|\bpos\b|marketplace|aca\s|exchange|medicaid|medicare|cobra|short[\s-]*term|gap\s*(plan|coverage)|supplemental|indemnity/i;

function classifyMarketType(data: Record<string, unknown>): 'healthshare' | 'traditional_insurance' | 'unknown' {
  const product = String(data.product || data.coverage_option || '');
  const carrier = String(data.carrier || '');
  const iua = String(data.iua_amount || '').trim();

  if (HEALTHSHARE_PATTERNS.test(product) || HEALTHSHARE_PATTERNS.test(carrier)) return 'healthshare';
  if (iua) return 'healthshare';
  if (INSURANCE_CARRIER_PATTERNS.test(carrier) || INSURANCE_PRODUCT_PATTERNS.test(product)) return 'traditional_insurance';
  return 'unknown';
}

function extractCanonicalNames(data: Record<string, unknown>, marketType: string) {
  const advisorRaw = String(data.advisor || data.producer_name || data.contact_owner || '').trim() || null;
  const agentRaw = String(data.agent || data.producer_name || data.contact_owner || '').trim() || null;

  if (marketType === 'healthshare') return { advisorName: advisorRaw, agentName: null };
  if (marketType === 'traditional_insurance') return { advisorName: null, agentName: agentRaw };
  return { advisorName: advisorRaw, agentName: agentRaw };
}

/**
 * Normalize a date-of-birth value to a canonical `YYYY-MM-DD` string for
 * duplicate comparison. Applied identically to both stored and incoming
 * values so the two sides always normalize consistently (even if the raw
 * formats differ, e.g. `01/15/1990` vs `1990-01-15`). Returns `null` when the
 * value is empty or unparseable, in which case the row is NOT matched on DOB.
 */
function normalizeDobForMatch(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === '0000-00-00') return null;

  // ISO `YYYY-MM-DD` (optionally with a time component)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // US `M/D/YYYY` or `MM/DD/YYYY`
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }

  // Fallback: parse and read UTC parts to avoid timezone drift.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * Build a stable identity key from first name + last name + DOB. Returns
 * `null` unless all three are present, so records missing a DOB fall through
 * to the existing email/phone duplicate checks and are never blocked on an
 * incomplete signal.
 */
function nameDobKey(first: unknown, last: unknown, dob: unknown): string | null {
  const f = String(first ?? '').trim().toLowerCase();
  const l = String(last ?? '').trim().toLowerCase();
  const d = normalizeDobForMatch(dob);
  if (!f || !l || !d) return null;
  return `${f}|${l}|${d}`;
}

/**
 * Reduce a phone to comparable digits so formatting differences dedupe
 * ("(303) 555-1212" and "303-555-1212" both → "3035551212"). Returns null when
 * there aren't enough digits to be a real phone, so blanks/garbage never match.
 */
function normalizePhoneDigits(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleGate = await requireActiveOrgCrmRoles(supabase, profile.organization_id, [
    'crm_admin',
    'crm_manager',
  ]);
  if (!roleGate.ok) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Hoisted so the catch can close out a job that was already created. Without
  // this, any throw after job creation (e.g. a dedup lookup failure) left the
  // row stuck in 'processing' forever with no reaper.
  let createdJobId: string | null = null;

  try {
    const parsed = importRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { moduleId, organizationId, mappings, data, fileName, saveMappingAs, skipDuplicates, onDuplicate } =
      parsed.data;

    // Entity Reupload (update-only + dry-run) lives at POST /api/crm/imports/update.
    // The wizard's "Update existing" mode calls that path; this route no longer
    // accepts upsert-on-duplicate so match/merge logic cannot diverge.
    if (onDuplicate === 'update') {
      return NextResponse.json(
        {
          error:
            'Update mode moved to POST /api/crm/imports/update (Entity Reupload). Use Import Wizard update preview or /crm/imports/update.',
        },
        { status: 410 },
      );
    }

    // Skip-duplicates needs the duplicate lookup; "create all"
    // (skipDuplicates=false) bypasses it.
    const wantUpdate = false;
    const dedupeEnabled = skipDuplicates || wantUpdate;

    // Verify org matches
    if (organizationId !== profile.organization_id) {
      return NextResponse.json({ error: 'Invalid organization' }, { status: 403 });
    }

    const { data: moduleRow, error: moduleLookupError } = await supabase
      .from('crm_modules')
      .select('id, key')
      .eq('id', moduleId)
      .eq('org_id', profile.organization_id)
      .maybeSingle();

    if (moduleLookupError || !moduleRow) {
      return NextResponse.json(
        { error: 'Module not found in your organization' },
        { status: 403 },
      );
    }
    const moduleKey = (moduleRow as { key: string | null }).key ?? null;

    /**
     * Build a `crm_records` insert row from a transformed CSV row using the
     * SAME normalization the create/PATCH path uses: date strings coerced to
     * ISO, canonical values mirrored onto indexed columns (carrier_id, start /
     * cancellation dates, group_name, …), and the title derived from
     * name/preferred fields. Without this, imported records saved values into
     * JSONB only and did not display or filter consistently with records added
     * through the form.
     */
    const buildInsertRecord = (row: TransformedRow): Record<string, unknown> => {
      const cleanData = sanitizeCrmDataJsonPatch(row.recordData);
      const columnUpdates = mergeCrmDataJsonIntoRowColumns(cleanData, {
        moduleKey,
        previousTitle: row.title,
      });
      const mType =
        (typeof columnUpdates.market_type === 'string' && columnUpdates.market_type
          ? (columnUpdates.market_type as string)
          : classifyMarketType(cleanData)) as
          | 'healthshare'
          | 'traditional_insurance'
          | 'unknown';
      const { advisorName, agentName } = extractCanonicalNames(cleanData, mType);
      return {
        org_id: organizationId,
        module_id: moduleId,
        owner_id: profile.id,
        created_by: profile.id,
        // Indexed columns derived from JSONB (title/email/phone/status/dates/…).
        ...columnUpdates,
        data: cleanData,
        email: (columnUpdates.email as string | null | undefined) ?? row.email,
        phone: (columnUpdates.phone as string | null | undefined) ?? row.phone,
        title: (columnUpdates.title as string | null | undefined) ?? row.title,
        status: (columnUpdates.status as string | null | undefined) ?? row.status,
        import_source: 'csv_import',
        market_type: mType,
        normalized_advisor_name: advisorName,
        normalized_agent_name: agentName,
        normalization_status: mType !== 'unknown' ? 'normalized' : 'needs_review',
      };
    };

    /**
     * Build the UPDATE payload for an upsert-matched record: merge the row's
     * mapped (non-empty) fields into the existing JSONB, then mirror the
     * canonical values onto indexed columns — excluding the out-of-band-owned
     * columns (advisor attribution / status / normalization) so an import can
     * never silently revert a manual owner reassignment. Only fields present in
     * the CSV row are added; existing values are never wiped.
     */
    const buildUpdateRecord = (
      row: TransformedRow,
      existing: { data: Record<string, unknown> | null; title: string | null },
    ): Record<string, unknown> => {
      const cleanPatch = sanitizeCrmDataJsonPatch(row.recordData);
      const prevData =
        existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
          ? (existing.data as Record<string, unknown>)
          : {};
      const mergedData = { ...prevData, ...cleanPatch };
      const norm = buildNormalizedRecordWrite(mergedData, {
        moduleKey,
        previousTitle: existing.title,
      });
      return {
        ...pickUpdateMirrorColumns(norm.columns),
        data: norm.data,
        updated_at: new Date().toISOString(),
      };
    };

    // Create import job
    const { data: importJob, error: jobError } = await supabase
      .from('crm_import_jobs')
      .insert({
        org_id: organizationId,
        module_id: moduleId,
        source_type: 'csv',
        file_name: fileName,
        total_rows: data.length,
        status: 'processing',
        started_at: new Date().toISOString(),
        created_by: profile.id,
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }
    createdJobId = importJob.id as string;

    // Build mapping lookup
    const fieldMappings = new Map<string, string>();
    mappings.forEach(m => {
      if (m.targetField) {
        fieldMappings.set(m.sourceColumn, m.targetField);
      }
    });

    // PHASE 1: Transform all rows and collect emails/phones for batch duplicate check
    interface TransformedRow {
      index: number;
      raw: Record<string, string>;
      recordData: Record<string, unknown>;
      email: string | null;
      phone: string | null;
      title: string | null;
      status: string | null;
      error?: string;
      dupReason?: 'email' | 'phone' | 'name_dob';
    }

    const transformedRows: TransformedRow[] = data.map((row, i) => {
      const recordData: Record<string, unknown> = {};
      let email: string | null = null;
      let phone: string | null = null;
      let title: string | null = null;
      let status: string | null = null;

      fieldMappings.forEach((targetField, sourceCol) => {
        const value = row[sourceCol];
        if (value !== undefined && value !== '') {
          if (targetField === 'email') {
            email = value;
          } else if (targetField === 'phone' || targetField === 'mobile') {
            phone = value;
          } else if (targetField === 'title' || targetField === 'first_name') {
            if (targetField === 'title') {
              title = value;
            } else if (!title) {
              title = value;
            }
          } else if (targetField === 'status' || targetField === 'lead_status' || targetField === 'contact_status') {
            status = value;
          }
          recordData[targetField] = value;
        }
      });

      // Build title from first_name + last_name if no explicit title
      if (!title && (recordData.first_name || recordData.last_name)) {
        title = [recordData.first_name, recordData.last_name].filter(Boolean).join(' ') || null;
      }

      return { index: i, raw: row, recordData, email, phone, title, status };
    });

    // PHASE 2: Batch duplicate check (single query instead of N queries).
    // Maps resolve a match to the existing record id so upsert mode can UPDATE
    // it; skip mode only needs `.has()`.
    const emailToId = new Map<string, string>();
    const phoneToId = new Map<string, string>();
    const nameDobToId = new Map<string, string>();

    if (dedupeEnabled) {
      // Normalize emails to lowercase for case-insensitive matching
      const emailsToCheck = transformedRows
        .map(r => r.email?.toLowerCase())
        .filter((e): e is string => !!e);

      // Batch check emails (case-insensitive via lowercase comparison).
      // Paged: an unbounded select silently stops at db.max_rows.
      if (emailsToCheck.length > 0) {
        const existingByEmail = await fetchAllForDedup<{ id: string; email: string | null }>(
          'email',
          (from, to) =>
            supabase
              .from('crm_records')
              .select('id, email')
              .eq('org_id', organizationId)
              .eq('module_id', moduleId)
              .not('email', 'is', null)
              .order('id', { ascending: true })
              .range(from, to),
        );

        for (const r of existingByEmail) {
          const key = r.email?.toLowerCase();
          if (key) emailToId.set(key, r.id);
        }
      }

      // Batch check phones (only for rows without email). Compare on digits so
      // formatting differences still dedupe — an exact-string `.in('phone', …)`
      // missed "(303) 555-1212" vs "3035551212".
      const hasPhoneCandidates = transformedRows.some(
        (r) => !r.email && normalizePhoneDigits(r.phone),
      );
      if (hasPhoneCandidates) {
        const existingByPhone = await fetchAllForDedup<{ id: string; phone: string | null }>(
          'phone',
          (from, to) =>
            supabase
              .from('crm_records')
              .select('id, phone')
              .eq('org_id', organizationId)
              .eq('module_id', moduleId)
              .not('phone', 'is', null)
              .order('id', { ascending: true })
              .range(from, to),
        );

        for (const r of existingByPhone) {
          const key = normalizePhoneDigits(r.phone);
          if (key) phoneToId.set(key, r.id);
        }
      }

      // Batch check name + DOB (dedup-on-import guard). Catches re-imported
      // records that share a person's name and date of birth even when the
      // email/phone differ or are blank — the dominant historical duplicate
      // class. Only runs if at least one incoming row carries a full name+DOB.
      const hasNameDobCandidates = transformedRows.some(
        r => nameDobKey(r.recordData.first_name, r.recordData.last_name, r.recordData.date_of_birth) !== null,
      );

      if (hasNameDobCandidates) {
        // Throws on error (see fetchAllForDedup). A failed lookup here used to be
        // logged and swallowed, which silently disabled the name+DOB guard and
        // let its duplicates through as inserts — fail the import instead.
        const existingByNameDob = await fetchAllForDedup<{
          id: string;
          fn: string | null;
          ln: string | null;
          dob: string | null;
        }>('name+dob', (from, to) =>
          supabase
            .from('crm_records')
            .select('id, fn:data->>first_name, ln:data->>last_name, dob:data->>date_of_birth')
            .eq('org_id', organizationId)
            .eq('module_id', moduleId)
            .order('id', { ascending: true })
            .range(from, to),
        );

        for (const r of existingByNameDob) {
          const key = nameDobKey(r.fn, r.ln, r.dob);
          if (key) nameDobToId.set(key, r.id);
        }
      }
    }

    // PHASE 3: Categorize rows into insert / update (upsert) / skip / error.
    const duplicateRows: TransformedRow[] = [];
    const validRows: TransformedRow[] = [];
    const updateRows: Array<{ row: TransformedRow; existingId: string }> = [];
    const seenNameDob = new Set<string>();

    for (const row of transformedRows) {
      if (dedupeEnabled) {
        const ndKey = nameDobKey(
          row.recordData.first_name,
          row.recordData.last_name,
          row.recordData.date_of_birth,
        );
        const rowPhoneDigits = normalizePhoneDigits(row.phone);
        // Resolve which existing DB record this row matches (email > phone > name+DOB).
        const emailMatchId = row.email ? emailToId.get(row.email.toLowerCase()) : undefined;
        const phoneMatchId = !row.email && rowPhoneDigits ? phoneToId.get(rowPhoneDigits) : undefined;
        const nameDobMatchId = ndKey ? nameDobToId.get(ndKey) : undefined;
        const matchedId = emailMatchId ?? phoneMatchId ?? nameDobMatchId;
        const dupReason: 'email' | 'phone' | 'name_dob' | null = emailMatchId
          ? 'email'
          : phoneMatchId
            ? 'phone'
            : nameDobMatchId
              ? 'name_dob'
              : null;

        if (matchedId && dupReason) {
          row.dupReason = dupReason;
          if (wantUpdate) {
            updateRows.push({ row, existingId: matchedId });
          } else {
            duplicateRows.push(row);
          }
          continue;
        }

        // No pre-existing DB record, but an earlier row in THIS file already
        // claimed this identity — skip the in-file duplicate (there is no DB
        // record to update yet, and we must not insert a second copy).
        if (ndKey && seenNameDob.has(ndKey)) {
          row.dupReason = 'name_dob';
          duplicateRows.push(row);
          continue;
        }

        // Remember this identity so a later identical row in the same upload
        // is also caught (the id maps only reflect pre-existing rows).
        if (ndKey) seenNameDob.add(ndKey);
      }
      validRows.push(row);
    }

    // PHASE 4: Batch insert valid records
    const BATCH_SIZE = 100;
    let success = 0;
    let errors = 0;
    const skipped = duplicateRows.length;
    const errorDetails: Array<{ row: number; error: string }> = [];
    const insertedRecords: Array<{ rowIndex: number; recordId: string; row: TransformedRow }> = [];

    // Process in batches
    for (let batchStart = 0; batchStart < validRows.length; batchStart += BATCH_SIZE) {
      const batch = validRows.slice(batchStart, batchStart + BATCH_SIZE);

      const recordsToInsert = batch.map(buildInsertRecord);

      const { data: insertedBatch, error: batchError } = await supabase
        .from('crm_records')
        .insert(recordsToInsert)
        .select('id');

      if (batchError) {
        // If batch fails due to unique constraint, fall back to row-by-row insert
        if ((batchError as any).code === '23505') {
          for (const row of batch) {
            const { data: singleRecord, error: singleError } = await supabase
              .from('crm_records')
              .insert(buildInsertRecord(row))
              .select('id');

            if (singleError) {
              errors++;
              const msg = (singleError as any).code === '23505'
                ? 'Duplicate email already exists'
                : singleError.message;
              errorDetails.push({ row: row.index + 1, error: msg });
              row.error = msg;
            } else if (singleRecord?.[0]) {
              success++;
              insertedRecords.push({
                rowIndex: row.index,
                recordId: singleRecord[0].id,
                row,
              });
            }
          }
        } else {
          // Non-duplicate batch error: mark all rows as failed
          batch.forEach(row => {
            errors++;
            errorDetails.push({ row: row.index + 1, error: batchError.message });
            row.error = batchError.message;
          });
        }
      } else if (insertedBatch) {
        // Map inserted records back to their rows
        insertedBatch.forEach((record, idx) => {
          success++;
          insertedRecords.push({
            rowIndex: batch[idx].index,
            recordId: record.id,
            row: batch[idx],
          });
        });
      }
    }

    // PHASE 4b: Upsert — update the existing record for each matched row.
    let updated = 0;
    const updatedRecords: Array<{ rowIndex: number; recordId: string; row: TransformedRow }> = [];

    if (updateRows.length > 0) {
      // Fetch current data + title for every matched record so the merge fills
      // fields without wiping existing values.
      const idsToFetch = [...new Set(updateRows.map((u) => u.existingId))];
      const existingById = new Map<
        string,
        { data: Record<string, unknown> | null; title: string | null }
      >();
      for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        const chunk = idsToFetch.slice(i, i + BATCH_SIZE);
        const { data: existingRecs } = await supabase
          .from('crm_records')
          .select('id, data, title')
          .eq('org_id', organizationId)
          .in('id', chunk);
        for (const r of existingRecs ?? []) {
          existingById.set(r.id as string, {
            data: (r.data as Record<string, unknown> | null) ?? null,
            title: (r.title as string | null) ?? null,
          });
        }
      }

      for (const { row, existingId } of updateRows) {
        const existing = existingById.get(existingId);
        if (!existing) continue; // record vanished between lookup and update
        const { error: upErr } = await supabase
          .from('crm_records')
          .update(buildUpdateRecord(row, existing))
          .eq('id', existingId)
          .eq('org_id', organizationId);

        if (upErr) {
          errors++;
          errorDetails.push({ row: row.index + 1, error: upErr.message });
          row.error = upErr.message;
        } else {
          updated++;
          updatedRecords.push({ rowIndex: row.index, recordId: existingId, row });
        }
      }
    }

    // PHASE 5: Batch insert import rows (tracking records)
    const importRowsToInsert = [
      // Duplicate rows
      ...duplicateRows.map(row => ({
        job_id: importJob.id,
        row_index: row.index,
        raw: row.raw,
        normalized: row.recordData,
        status: 'skipped' as const,
        // `match_type` is constrained to new|exact_match|fuzzy_match|duplicate;
        // all dedup hits (email, phone, name+DOB) record as 'duplicate'. The
        // per-reason breakdown is surfaced in the API response instead.
        match_type: 'duplicate' as const,
      })),
      // Successfully inserted rows
      ...insertedRecords.map(({ rowIndex, recordId, row }) => ({
        job_id: importJob.id,
        row_index: rowIndex,
        raw: row.raw,
        normalized: row.recordData,
        record_id: recordId,
        status: 'inserted' as const,
      })),
      // Successfully updated (upserted) rows
      ...updatedRecords.map(({ rowIndex, recordId, row }) => ({
        job_id: importJob.id,
        row_index: rowIndex,
        raw: row.raw,
        normalized: row.recordData,
        record_id: recordId,
        status: 'updated' as const,
        match_type: 'exact_match' as const,
      })),
      // Error rows (from both inserts and updates)
      ...[...validRows, ...updateRows.map(u => u.row)]
        .filter(r => r.error)
        .map(row => ({
          job_id: importJob.id,
          row_index: row.index,
          raw: row.raw,
          status: 'error' as const,
          error: row.error,
        })),
    ];

    // Insert import rows in batches
    for (let i = 0; i < importRowsToInsert.length; i += BATCH_SIZE) {
      const batch = importRowsToInsert.slice(i, i + BATCH_SIZE);
      await supabase.from('crm_import_rows').insert(batch);
    }

    // Update import job status
    await supabase
      .from('crm_import_jobs')
      .update({
        status: 'completed',
        processed_rows: data.length,
        inserted_count: success,
        updated_count: updated,
        skipped_count: skipped,
        error_count: errors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importJob.id);

    // Save mapping if requested
    let savedMappingId: string | null = null;
    if (saveMappingAs && saveMappingAs.trim()) {
      // Build mapping object from the column mappings
      const mappingObject: Record<string, string> = {};
      mappings.forEach(m => {
        if (m.targetField) {
          mappingObject[m.sourceColumn] = m.targetField;
        }
      });

      const { data: savedMapping, error: mappingError } = await supabase
        .from('crm_import_mappings')
        .insert({
          org_id: organizationId,
          module_id: moduleId,
          name: saveMappingAs.trim(),
          mapping: mappingObject,
          created_by: profile.id,
        })
        .select('id')
        .single();

      if (!mappingError && savedMapping) {
        savedMappingId = savedMapping.id;

        // Update the import job with the mapping reference
        await supabase
          .from('crm_import_jobs')
          .update({ mapping_id: savedMappingId })
          .eq('id', importJob.id);
      }
    }

    // Per-reason breakdown of skipped duplicates so the UI can show *why*
    // rows were skipped (e.g. "5 by email, 3 by name+DOB") instead of an
    // opaque total. Rows skipped before dupReason was set count as email.
    const skippedByReason = {
      email: duplicateRows.filter(r => r.dupReason === 'email').length,
      phone: duplicateRows.filter(r => r.dupReason === 'phone').length,
      name_dob: duplicateRows.filter(r => r.dupReason === 'name_dob').length,
    };

    return NextResponse.json({
      success,
      updated,
      skipped,
      skippedByReason,
      errors,
      total: data.length,
      jobId: importJob.id,
      savedMappingId,
      errorDetails: errorDetails.slice(0, 10), // Return first 10 errors
    });
  } catch (err) {
    console.error('Import error:', err);

    // Close out the job so it does not sit in 'processing' indefinitely. Best
    // effort — if this write also fails we still want to return the original
    // error, which is the one that explains what went wrong.
    if (createdJobId) {
      const { error: closeError } = await supabase
        .from('crm_import_jobs')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Import failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', createdJobId)
        .eq('org_id', profile.organization_id);

      if (closeError) {
        console.error('Import error: failed to mark job failed:', closeError.message);
      }
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}
