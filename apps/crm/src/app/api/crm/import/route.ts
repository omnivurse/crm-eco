import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';


interface ColumnMapping {
  sourceColumn: string;
  targetField: string | null;
}

interface ImportRequest {
  moduleId: string;
  organizationId: string;
  mappings: ColumnMapping[];
  data: Record<string, string>[];
  fileName?: string;
  saveMappingAs?: string; // Optional: save mapping template for reuse
  skipDuplicates?: boolean; // Skip records that already exist (by email/phone)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body: ImportRequest = await request.json();
    const { moduleId, organizationId, mappings, data, fileName, saveMappingAs, skipDuplicates } = body;

    // Verify org matches
    if (organizationId !== profile.organization_id) {
      return NextResponse.json({ error: 'Invalid organization' }, { status: 403 });
    }

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

    // PHASE 2: Batch duplicate check (single query instead of N queries)
    let duplicateEmails = new Set<string>();
    let duplicatePhones = new Set<string>();

    if (skipDuplicates) {
      const emailsToCheck = transformedRows.map(r => r.email).filter((e): e is string => !!e);
      const phonesToCheck = transformedRows.map(r => r.phone).filter((p): p is string => !!p);

      // Batch check emails
      if (emailsToCheck.length > 0) {
        const { data: existingByEmail } = await supabase
          .from('crm_records')
          .select('email')
          .eq('org_id', organizationId)
          .eq('module_id', moduleId)
          .in('email', emailsToCheck);

        if (existingByEmail) {
          duplicateEmails = new Set(existingByEmail.map(r => r.email).filter((e): e is string => !!e));
        }
      }

      // Batch check phones (only for rows without email)
      if (phonesToCheck.length > 0) {
        const { data: existingByPhone } = await supabase
          .from('crm_records')
          .select('phone')
          .eq('org_id', organizationId)
          .eq('module_id', moduleId)
          .in('phone', phonesToCheck);

        if (existingByPhone) {
          duplicatePhones = new Set(existingByPhone.map(r => r.phone).filter((p): p is string => !!p));
        }
      }
    }

    // PHASE 3: Categorize rows into duplicates, valid, and errors
    const duplicateRows: TransformedRow[] = [];
    const validRows: TransformedRow[] = [];

    for (const row of transformedRows) {
      if (skipDuplicates) {
        const isDuplicateByEmail = row.email && duplicateEmails.has(row.email);
        const isDuplicateByPhone = !row.email && row.phone && duplicatePhones.has(row.phone);

        if (isDuplicateByEmail || isDuplicateByPhone) {
          duplicateRows.push(row);
          continue;
        }
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

      const recordsToInsert = batch.map(row => ({
        org_id: organizationId,
        module_id: moduleId,
        owner_id: profile.id,
        title: row.title,
        status: row.status,
        data: row.recordData,
        email: row.email,
        phone: row.phone,
        created_by: profile.id,
      }));

      const { data: insertedBatch, error: batchError } = await supabase
        .from('crm_records')
        .insert(recordsToInsert)
        .select('id');

      if (batchError) {
        // If batch insert fails, mark all rows in batch as errors
        batch.forEach(row => {
          errors++;
          errorDetails.push({ row: row.index + 1, error: batchError.message });
          row.error = batchError.message;
        });
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

    // PHASE 5: Batch insert import rows (tracking records)
    const importRowsToInsert = [
      // Duplicate rows
      ...duplicateRows.map(row => ({
        job_id: importJob.id,
        row_index: row.index,
        raw: row.raw,
        normalized: row.recordData,
        status: 'skipped' as const,
        match_type: 'duplicate',
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
      // Error rows
      ...validRows.filter(r => r.error).map(row => ({
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

    return NextResponse.json({
      success,
      skipped,
      errors,
      total: data.length,
      jobId: importJob.id,
      savedMappingId,
      errorDetails: errorDetails.slice(0, 10), // Return first 10 errors
    });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}
