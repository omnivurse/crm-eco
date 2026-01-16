import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { transformCsvRowToRecord, validateCsvRow } from '@/lib/imports/contacts-mapping';

// Type for profile with organization
interface ProfileWithOrg {
  id: string;
  organization_id: string;
}

// Type for CRM module
interface CrmModule {
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSupabaseAny() {
  const supabase = await createServerSupabaseClient();
  return supabase as any;
}

/**
 * POST /api/imports/contacts
 * Import contacts from CSV data
 * 
 * Body: { rows: Record<string, string>[], options?: { skipDuplicates?: boolean } }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseAny();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's organization
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    const profile = profileData as ProfileWithOrg | null;
    
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    // Get Contacts module
    const { data: moduleData } = await supabase
      .from('crm_modules')
      .select('id')
      .eq('org_id', profile.organization_id)
      .eq('key', 'contacts')
      .single();
    
    const contactsModule = moduleData as CrmModule | null;
    
    if (!contactsModule) {
      return NextResponse.json({ error: 'Contacts module not found' }, { status: 400 });
    }
    
    // Parse request body
    const body = await request.json();
    const { rows, options = {} } = body as { 
      rows: Record<string, string>[]; 
      options?: { skipDuplicates?: boolean } 
    };
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }
    
    // Create import job
    const { data: importJob, error: jobError } = await supabase
      .from('crm_import_jobs')
      .insert({
        org_id: profile.organization_id,
        module_id: contactsModule.id,
        source_type: 'csv',
        file_name: 'contacts_upload.csv',
        status: 'processing',
        total_rows: rows.length,
        started_at: new Date().toISOString(),
        created_by: profile.id
      })
      .select()
      .single();
    
    if (jobError) {
      console.error('Failed to create import job:', jobError);
      return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });
    }
    
    // Process rows
    const results = {
      imported: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as { row: number; error: string }[]
    };
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Validate row
        const validation = validateCsvRow(row);
        if (!validation.valid) {
          results.errors++;
          results.errorDetails.push({ row: i + 1, error: validation.errors.join('; ') });
          continue;
        }
        
        // Transform row to CRM record format
        const { title, status, email, phone, data } = transformCsvRowToRecord(row);
        
        // Check for duplicates by email if option enabled
        if (options.skipDuplicates && email) {
          const { data: existing } = await supabase
            .from('crm_records')
            .select('id')
            .eq('org_id', profile.organization_id)
            .eq('module_id', contactsModule.id)
            .eq('email', email)
            .limit(1);
          
          if (existing && existing.length > 0) {
            results.skipped++;
            continue;
          }
        }
        
        // Insert record
        const { error: insertError } = await supabase
          .from('crm_records')
          .insert({
            org_id: profile.organization_id,
            module_id: contactsModule.id,
            title,
            status,
            email,
            phone,
            data,
            created_by: profile.id
          });
        
        if (insertError) {
          results.errors++;
          results.errorDetails.push({ row: i + 1, error: insertError.message });
        } else {
          results.imported++;
        }
      } catch (err) {
        results.errors++;
        results.errorDetails.push({ 
          row: i + 1, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }
    
    // Update import job with results
    await supabase
      .from('crm_import_jobs')
      .update({
        status: results.errors > 0 && results.imported === 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        processed_rows: rows.length,
        inserted_count: results.imported,
        skipped_count: results.skipped,
        error_count: results.errors,
        stats: { errorDetails: results.errorDetails.slice(0, 100) } // Limit error details
      })
      .eq('id', importJob.id);
    
    return NextResponse.json({
      success: true,
      jobId: importJob.id,
      results: {
        total: rows.length,
        imported: results.imported,
        skipped: results.skipped,
        errors: results.errors,
        errorDetails: results.errorDetails.slice(0, 20) // Return first 20 errors
      }
    });
    
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/imports/contacts
 * Get import job status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseAny();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    const profile = profileData as ProfileWithOrg | null;
    
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (jobId) {
      // Get specific job
      const { data: job, error } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('org_id', profile.organization_id)
        .single();
      
      if (error) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      
      return NextResponse.json(job);
    } else {
      // Get recent jobs
      const { data: jobs, error } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('org_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
      }
      
      return NextResponse.json(jobs || []);
    }
  } catch (error) {
    console.error('Get import jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
