'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { parseCSV, importMembersFromRows, importAdvisorsFromRows, importLeadsFromRows } from '@crm-eco/lib';
import type { ImportResult, ImportRowData } from '@crm-eco/lib';

export type ImportFormState = {
  success?: boolean;
  error?: string;
  jobId?: string;
  result?: ImportResult;
};

// Helper to get untyped Supabase client due to @supabase/ssr 0.5.x type inference limitations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSupabase(): Promise<any> {
  return await createServerSupabaseClient();
}

export async function createImportJob(
  prevState: ImportFormState,
  formData: FormData
): Promise<ImportFormState> {
  try {
    const supabase = await getSupabase();
    
    // Get current user's profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { error: 'Profile not found' };
    }
    
    // Check role
    if (!['owner', 'admin'].includes(profile.role)) {
      return { error: 'Unauthorized: Only admins can import data' };
    }
    
    // Get form data
    const entityType = formData.get('entityType') as 'member' | 'advisor' | 'lead';
    const sourceName = formData.get('sourceName') as string;
    const file = formData.get('file') as File;
    
    if (!entityType) {
      return { error: 'Entity type is required' };
    }
    
    if (!file || file.size === 0) {
      return { error: 'CSV file is required' };
    }
    
    // Parse CSV content
    const csvContent = await file.text();
    const { rows } = parseCSV(csvContent);
    
    if (rows.length === 0) {
      return { error: 'CSV file is empty or has no data rows' };
    }
    
    // Create import job
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        organization_id: profile.organization_id,
        created_by_profile_id: profile.id,
        entity_type: entityType,
        source_name: sourceName || null,
        file_name: file.name,
        total_rows: rows.length,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (jobError || !job) {
      return { error: `Failed to create import job: ${jobError?.message}` };
    }
    
    // Convert rows to ImportRowData format
    const importRows: ImportRowData[] = rows.map((data, index) => ({
      index: index + 1, // 1-based for display
      data,
    }));
    
    // Create import context
    const context = {
      supabase,
      organizationId: profile.organization_id,
      profileId: profile.id,
      jobId: job.id,
    };
    
    // Run the appropriate import function
    let result: ImportResult;
    
    switch (entityType) {
      case 'member':
        result = await importMembersFromRows(context, importRows);
        break;
      case 'advisor':
        result = await importAdvisorsFromRows(context, importRows);
        break;
      case 'lead':
        result = await importLeadsFromRows(context, importRows);
        break;
      default:
        return { error: `Invalid entity type: ${entityType}` };
    }
    
    // Update job with results
    await supabase
      .from('import_jobs')
      .update({
        processed_rows: result.total,
        inserted_count: result.inserted,
        updated_count: result.updated,
        skipped_count: result.skipped,
        error_count: result.errors.length,
        status: result.errors.length === result.total ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    
    return {
      success: true,
      jobId: job.id,
      result,
    };
  } catch (err) {
    console.error('Import error:', err);
    return { error: err instanceof Error ? err.message : 'Unknown error occurred' };
  }
}

