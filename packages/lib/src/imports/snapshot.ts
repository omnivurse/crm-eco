/**
 * Snapshot and Rollback Handler
 * 
 * Provides snapshot creation for import operations and rollback capabilities.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ImportSnapshot, Json } from '../types';
import type { EntityType } from './fieldMapping';

// ============================================================================
// TYPES
// ============================================================================

export interface SnapshotContext {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  importJobId: string;
}

export interface CreateSnapshotParams {
  importJobRowId?: string;
  entityType: EntityType;
  entityId: string;
  action: 'insert' | 'update';
  dataBefore: Record<string, unknown> | null;
  dataAfter: Record<string, unknown>;
}

export interface RollbackResult {
  success: boolean;
  rolledBackCount: number;
  failedCount: number;
  errors: Array<{ snapshotId: string; error: string }>;
}

// ============================================================================
// SNAPSHOT CREATION
// ============================================================================

/**
 * Create a snapshot for a single entity change
 */
export async function createSnapshot(
  context: SnapshotContext,
  params: CreateSnapshotParams
): Promise<{ data: ImportSnapshot | null; error: Error | null }> {
  const { supabase, organizationId, importJobId } = context;
  
  const { data, error } = await supabase
    .from('import_snapshots')
    .insert({
      organization_id: organizationId,
      import_job_id: importJobId,
      import_job_row_id: params.importJobRowId || null,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      data_before: params.dataBefore as Json,
      data_after: params.dataAfter as Json,
    })
    .select()
    .single();
  
  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  
  return { data, error: null };
}

/**
 * Create snapshots for multiple entities in batch
 */
export async function createSnapshotsBatch(
  context: SnapshotContext,
  snapshots: CreateSnapshotParams[]
): Promise<{ count: number; error: Error | null }> {
  const { supabase, organizationId, importJobId } = context;
  
  const records = snapshots.map(s => ({
    organization_id: organizationId,
    import_job_id: importJobId,
    import_job_row_id: s.importJobRowId || null,
    entity_type: s.entityType,
    entity_id: s.entityId,
    action: s.action,
    data_before: s.dataBefore as Json,
    data_after: s.dataAfter as Json,
  }));
  
  const { error } = await supabase
    .from('import_snapshots')
    .insert(records);
  
  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  
  return { count: records.length, error: null };
}

// ============================================================================
// SNAPSHOT RETRIEVAL
// ============================================================================

/**
 * Get all snapshots for an import job
 */
export async function getJobSnapshots(
  supabase: SupabaseClient<Database>,
  importJobId: string
): Promise<{ data: ImportSnapshot[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('import_snapshots')
    .select('*')
    .eq('import_job_id', importJobId)
    .eq('is_rolled_back', false)
    .order('created_at', { ascending: false });
  
  if (error) {
    return { data: [], error: new Error(error.message) };
  }
  
  return { data: data || [], error: null };
}

/**
 * Check if a job can be rolled back
 */
export async function canRollback(
  supabase: SupabaseClient<Database>,
  importJobId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('import_jobs')
    .select('can_rollback, rollback_status')
    .eq('id', importJobId)
    .single();
  
  if (error || !data) return false;
  
  return data.can_rollback && !data.rollback_status;
}

// ============================================================================
// ROLLBACK OPERATIONS
// ============================================================================

/**
 * Rollback a single snapshot
 */
async function rollbackSnapshot(
  supabase: SupabaseClient<Database>,
  snapshot: ImportSnapshot
): Promise<{ success: boolean; error: string | null }> {
  try {
    const entityType = snapshot.entity_type as EntityType;
    const tableName = getTableName(entityType);
    
    if (snapshot.action === 'insert') {
      // Delete the inserted record
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', snapshot.entity_id);
      
      if (error) {
        return { success: false, error: error.message };
      }
    } else if (snapshot.action === 'update' && snapshot.data_before) {
      // Restore the previous state
      const { error } = await supabase
        .from(tableName)
        .update(snapshot.data_before as Record<string, unknown>)
        .eq('id', snapshot.entity_id);
      
      if (error) {
        return { success: false, error: error.message };
      }
    }
    
    // Mark snapshot as rolled back
    await supabase
      .from('import_snapshots')
      .update({
        is_rolled_back: true,
        rolled_back_at: new Date().toISOString(),
      })
      .eq('id', snapshot.id);
    
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get the table name for an entity type
 */
function getTableName(entityType: EntityType): 'members' | 'advisors' | 'leads' | 'plans' | 'memberships' {
  switch (entityType) {
    case 'member': return 'members';
    case 'advisor': return 'advisors';
    case 'lead': return 'leads';
    case 'plan': return 'plans';
    case 'membership': return 'memberships';
  }
}

/**
 * Rollback all changes from an import job
 */
export async function rollbackImportJob(
  supabase: SupabaseClient<Database>,
  importJobId: string
): Promise<RollbackResult> {
  // Update job status
  await supabase
    .from('import_jobs')
    .update({ rollback_status: 'in_progress' })
    .eq('id', importJobId);
  
  // Get all snapshots for this job (in reverse order)
  const { data: snapshots, error } = await supabase
    .from('import_snapshots')
    .select('*')
    .eq('import_job_id', importJobId)
    .eq('is_rolled_back', false)
    .order('created_at', { ascending: false });
  
  if (error || !snapshots) {
    await supabase
      .from('import_jobs')
      .update({ rollback_status: 'failed' })
      .eq('id', importJobId);
    
    return {
      success: false,
      rolledBackCount: 0,
      failedCount: 0,
      errors: [{ snapshotId: '', error: error?.message || 'Failed to fetch snapshots' }],
    };
  }
  
  const result: RollbackResult = {
    success: true,
    rolledBackCount: 0,
    failedCount: 0,
    errors: [],
  };
  
  // Rollback each snapshot
  for (const snapshot of snapshots) {
    const { success, error: rollbackError } = await rollbackSnapshot(supabase, snapshot);
    
    if (success) {
      result.rolledBackCount++;
    } else {
      result.failedCount++;
      result.errors.push({ snapshotId: snapshot.id, error: rollbackError || 'Unknown error' });
    }
  }
  
  // Update job status
  const finalStatus = result.failedCount === 0 ? 'completed' : 'failed';
  await supabase
    .from('import_jobs')
    .update({
      rollback_status: finalStatus,
      rollback_at: new Date().toISOString(),
    })
    .eq('id', importJobId);
  
  result.success = result.failedCount === 0;
  
  return result;
}

/**
 * Get rollback status for an import job
 */
export async function getRollbackStatus(
  supabase: SupabaseClient<Database>,
  importJobId: string
): Promise<{
  canRollback: boolean;
  rollbackStatus: string | null;
  snapshotCount: number;
  rolledBackCount: number;
}> {
  const { data: job } = await supabase
    .from('import_jobs')
    .select('can_rollback, rollback_status')
    .eq('id', importJobId)
    .single();
  
  const { count: totalSnapshots } = await supabase
    .from('import_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('import_job_id', importJobId);
  
  const { count: rolledBackSnapshots } = await supabase
    .from('import_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('import_job_id', importJobId)
    .eq('is_rolled_back', true);
  
  return {
    canRollback: job?.can_rollback && !job?.rollback_status,
    rollbackStatus: job?.rollback_status || null,
    snapshotCount: totalSnapshots || 0,
    rolledBackCount: rolledBackSnapshots || 0,
  };
}

/**
 * Fetch entity data before update for snapshot
 */
export async function fetchEntityForSnapshot(
  supabase: SupabaseClient<Database>,
  entityType: EntityType,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const tableName = getTableName(entityType);
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', entityId)
    .single();
  
  if (error || !data) return null;
  
  return data as Record<string, unknown>;
}
