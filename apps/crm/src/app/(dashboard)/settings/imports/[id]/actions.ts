'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { rollbackImportJob } from '@crm-eco/lib';

interface ProfileResult {
  id: string;
  organization_id: string;
  role: string;
}

interface ImportJobResult {
  id: string;
  organization_id: string;
  can_rollback: boolean;
  rollback_status: string | null;
}

export async function rollbackImport(importJobId: string): Promise<{ success?: boolean; error?: string }> {
  // Note: Using type assertion due to @supabase/ssr 0.5.x type inference limitations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerSupabaseClient() as any;
  
  // Get current user's profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, role')
    .eq('user_id', user.id)
    .single() as { data: ProfileResult | null };
  
  if (!profile) {
    return { error: 'Profile not found' };
  }
  
  if (!['owner', 'admin'].includes(profile.role)) {
    return { error: 'Unauthorized: Only admins can rollback imports' };
  }
  
  // Verify the import job belongs to this organization
  const { data: job } = await supabase
    .from('import_jobs')
    .select('id, organization_id, can_rollback, rollback_status')
    .eq('id', importJobId)
    .single() as { data: ImportJobResult | null };
  
  if (!job) {
    return { error: 'Import job not found' };
  }
  
  if (job.organization_id !== profile.organization_id) {
    return { error: 'Unauthorized: Import job belongs to a different organization' };
  }
  
  if (!job.can_rollback) {
    return { error: 'This import cannot be rolled back' };
  }
  
  if (job.rollback_status) {
    return { error: `Rollback already ${job.rollback_status}` };
  }
  
  // Perform rollback
  try {
    const result = await rollbackImportJob(supabase, importJobId);
    
    if (!result.success) {
      return { 
        error: `Rollback completed with errors: ${result.failedCount} of ${result.rolledBackCount + result.failedCount} failed` 
      };
    }
    
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Rollback failed' };
  }
}
