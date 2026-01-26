import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';


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
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Read-only context
          }
        },
      },
    }
  );

  // Verify user is authenticated and has permission
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, crm_role, organization_id')
    .eq('user_id', user.id)
    .single();

  if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
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

    // Process records
    let success = 0;
    let errors = 0;
    let skipped = 0;
    const errorDetails: Array<{ row: number; error: string }> = [];

    // Build mapping lookup
    const fieldMappings = new Map<string, string>();
    mappings.forEach(m => {
      if (m.targetField) {
        fieldMappings.set(m.sourceColumn, m.targetField);
      }
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      try {
        // Transform row data according to mappings
        const recordData: Record<string, unknown> = {};
        let email: string | null = null;
        let phone: string | null = null;
        let title: string | null = null;
        let status: string | null = null;

        // System fields that should be stored at top level, not in data
        const SYSTEM_FIELDS = ['email', 'phone', 'mobile', 'title', 'status', 'lead_status', 'contact_status'];

        fieldMappings.forEach((targetField, sourceCol) => {
          const value = row[sourceCol];
          if (value !== undefined && value !== '') {
            // Extract system fields
            if (targetField === 'email') {
              email = value;
            } else if (targetField === 'phone' || targetField === 'mobile') {
              phone = value;
            } else if (targetField === 'title' || targetField === 'first_name') {
              // Use first_name as title if title not explicitly mapped
              if (targetField === 'title') {
                title = value;
              } else if (!title) {
                title = value; // Will be overridden if title is also mapped
              }
            } else if (targetField === 'status' || targetField === 'lead_status' || targetField === 'contact_status') {
              status = value;
            }

            // All fields also go into data for custom field access
            recordData[targetField] = value;
          }
        });

        // Build title from first_name + last_name if no explicit title
        if (!title && (recordData.first_name || recordData.last_name)) {
          title = [recordData.first_name, recordData.last_name].filter(Boolean).join(' ') || null;
        }

        // Check for duplicates if skipDuplicates is enabled
        if (skipDuplicates && (email || phone)) {
          let query = supabase
            .from('crm_records')
            .select('id')
            .eq('org_id', organizationId)
            .eq('module_id', moduleId);

          // Check by email first (primary duplicate key)
          if (email) {
            query = query.eq('email', email);
          } else if (phone) {
            // Fall back to phone if no email
            query = query.eq('phone', phone);
          }

          const { data: existing } = await query.limit(1);

          if (existing && existing.length > 0) {
            // Record is a duplicate - skip it
            skipped++;
            await supabase.from('crm_import_rows').insert({
              job_id: importJob.id,
              row_index: i,
              raw: row,
              normalized: recordData,
              status: 'skipped',
              match_type: 'duplicate',
            });
            continue;
          }
        }

        // Insert the record
        const { data: record, error: insertError } = await supabase
          .from('crm_records')
          .insert({
            org_id: organizationId,
            module_id: moduleId,
            owner_id: profile.id,
            title,
            status,
            data: recordData,
            email,
            phone,
            created_by: profile.id,
          })
          .select('id')
          .single();

        if (insertError) {
          throw insertError;
        }

        // Record import row
        await supabase.from('crm_import_rows').insert({
          job_id: importJob.id,
          row_index: i,
          raw: row,
          normalized: recordData,
          record_id: record.id,
          status: 'inserted',
        });

        success++;
      } catch (err) {
        errors++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errorDetails.push({ row: i + 1, error: errorMsg });

        // Record failed import row
        await supabase.from('crm_import_rows').insert({
          job_id: importJob.id,
          row_index: i,
          raw: row,
          status: 'error',
          error: errorMsg,
        });
      }
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
