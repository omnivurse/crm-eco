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
    const { moduleId, organizationId, mappings, data, fileName, saveMappingAs } = body;

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

        fieldMappings.forEach((targetField, sourceCol) => {
          const value = row[sourceCol];
          if (value !== undefined && value !== '') {
            recordData[targetField] = value;

            // Extract system fields
            if (targetField === 'email') email = value;
            if (targetField === 'phone' || targetField === 'mobile') phone = value;
          }
        });

        // Insert the record
        const { data: record, error: insertError } = await supabase
          .from('crm_records')
          .insert({
            org_id: organizationId,
            module_id: moduleId,
            owner_id: profile.id,
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
