'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { 
  validateBatch, 
  type BatchValidationResult, 
  type EntityType,
  createSnapshot,
  type SnapshotContext,
  fetchEntityForSnapshot,
} from '@crm-eco/lib';
import type { Json } from '@crm-eco/lib/types';

// ============================================================================
// TYPES
// ============================================================================

interface ProfileResult {
  id: string;
  organization_id: string;
  role: string;
}

interface ExecuteImportParams {
  entityType: EntityType;
  sourceName: string;
  fileName: string;
  rows: Array<{ index: number; data: Record<string, string> }>;
  mapping: Record<string, string>;
  duplicateStrategy: 'skip' | 'update' | 'error';
  isIncremental: boolean;
  validationResult: BatchValidationResult | null;
}

interface ExecuteImportResult {
  jobId?: string;
  result?: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  error?: string;
}

// ============================================================================
// VALIDATION ACTION
// ============================================================================

export async function validatePreview(
  entityType: EntityType,
  rows: Array<{ index: number; data: Record<string, string> }>,
  duplicateStrategy: 'skip' | 'update' | 'error'
): Promise<BatchValidationResult> {
  // Note: Using type assertion due to @supabase/ssr 0.5.x type inference limitations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerSupabaseClient() as any;
  
  // Get current user's profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, role')
    .eq('user_id', user.id)
    .single() as { data: ProfileResult | null };
  
  if (!profile) {
    throw new Error('Profile not found');
  }
  
  if (!['owner', 'admin'].includes(profile.role)) {
    throw new Error('Unauthorized');
  }
  
  // Run validation
  const result = await validateBatch(
    {
      supabase,
      organizationId: profile.organization_id,
      entityType,
      duplicateStrategy,
      isIncremental: false,
    },
    rows
  );
  
  return result;
}

// ============================================================================
// EXECUTE IMPORT ACTION
// ============================================================================

export async function executeImport(params: ExecuteImportParams): Promise<ExecuteImportResult> {
  const { 
    entityType, 
    sourceName, 
    fileName, 
    rows, 
    duplicateStrategy, 
    isIncremental,
    validationResult 
  } = params;
  
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
    return { error: 'Unauthorized' };
  }
  
  // Create import job
  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .insert({
      organization_id: profile.organization_id,
      created_by_profile_id: profile.id,
      entity_type: entityType,
      source_name: sourceName,
      file_name: fileName,
      total_rows: rows.length,
      status: 'processing',
      is_preview: false,
      is_incremental: isIncremental,
      can_rollback: true,
      duplicate_strategy: duplicateStrategy,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null };
  
  if (jobError || !job) {
    return { error: `Failed to create import job: ${jobError?.message}` };
  }
  
  const snapshotContext: SnapshotContext = {
    supabase,
    organizationId: profile.organization_id,
    importJobId: job.id,
  };
  
  // Process rows
  const result = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };
  
  for (const row of rows) {
    const validationRow = validationResult?.rows.find(r => r.rowIndex === row.index);
    
    try {
      // Skip invalid rows
      if (validationRow && !validationRow.isValid) {
        result.errors++;
        await recordRowResult(supabase, job.id, row.index, row.data, 'error', 'Validation failed');
        continue;
      }
      
      // Handle based on match type
      if (validationRow?.matchType === 'exact_match' || validationRow?.matchType === 'fuzzy_match') {
        if (duplicateStrategy === 'skip') {
          result.skipped++;
          await recordRowResult(supabase, job.id, row.index, row.data, 'skipped', 'Duplicate skipped');
          continue;
        }
        
        if (duplicateStrategy === 'error') {
          result.errors++;
          await recordRowResult(supabase, job.id, row.index, row.data, 'error', 'Duplicate record');
          continue;
        }
        
        // Update existing record
        const entityId = validationRow.existingEntityId!;
        
        // Create snapshot before update
        const existingData = await fetchEntityForSnapshot(
          supabase as SnapshotContext['supabase'], 
          entityType, 
          entityId
        );
        
        const updateResult = await updateEntity(
          supabase,
          entityType,
          entityId,
          row.data,
          validationRow.linkedEntities,
          isIncremental,
          existingData
        );
        
        if (updateResult.error) {
          result.errors++;
          await recordRowResult(supabase, job.id, row.index, row.data, 'error', updateResult.error);
        } else {
          // Record snapshot
          await createSnapshot(snapshotContext, {
            entityType,
            entityId,
            action: 'update',
            dataBefore: existingData,
            dataAfter: updateResult.data!,
          });
          
          result.updated++;
          await recordRowResult(supabase, job.id, row.index, row.data, 'updated', null, entityId);
        }
      } else {
        // Insert new record
        const insertResult = await insertEntity(
          supabase,
          profile.organization_id,
          entityType,
          row.data,
          validationRow?.linkedEntities || {}
        );
        
        if (insertResult.error) {
          result.errors++;
          await recordRowResult(supabase, job.id, row.index, row.data, 'error', insertResult.error);
        } else {
          // Record snapshot
          await createSnapshot(snapshotContext, {
            entityType,
            entityId: insertResult.entityId!,
            action: 'insert',
            dataBefore: null,
            dataAfter: insertResult.data!,
          });
          
          result.inserted++;
          await recordRowResult(supabase, job.id, row.index, row.data, 'inserted', null, insertResult.entityId);
        }
      }
    } catch (err) {
      result.errors++;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      await recordRowResult(supabase, job.id, row.index, row.data, 'error', errorMsg);
    }
  }
  
  // Update job with final results
  await supabase
    .from('import_jobs')
    .update({
      processed_rows: result.total,
      inserted_count: result.inserted,
      updated_count: result.updated,
      skipped_count: result.skipped,
      error_count: result.errors,
      status: result.errors === result.total ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  
  return { jobId: job.id, result };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordRowResult(
  supabase: any,
  jobId: string,
  rowIndex: number,
  data: Record<string, string>,
  status: 'pending' | 'inserted' | 'updated' | 'skipped' | 'error',
  errorMessage: string | null,
  entityId?: string
) {
  await supabase.from('import_job_rows').insert({
    import_job_id: jobId,
    row_index: rowIndex,
    raw_data: data as unknown as Json,
    normalized_data: data as unknown as Json,
    status,
    error_message: errorMessage,
    entity_id: entityId || null,
    processed_at: new Date().toISOString(),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertEntity(
  supabase: any,
  organizationId: string,
  entityType: EntityType,
  data: Record<string, string>,
  linkedEntities: Record<string, string | null>
): Promise<{ entityId?: string; data?: Record<string, unknown>; error?: string }> {
  const entityData = buildEntityData(organizationId, entityType, data, linkedEntities);
  
  const tableName = getTableName(entityType);
  const { data: inserted, error } = await supabase
    .from(tableName)
    .insert(entityData)
    .select()
    .single();
  
  if (error) {
    return { error: error.message };
  }
  
  return { entityId: inserted.id, data: inserted as Record<string, unknown> };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateEntity(
  supabase: any,
  entityType: EntityType,
  entityId: string,
  data: Record<string, string>,
  linkedEntities: Record<string, string | null>,
  isIncremental: boolean,
  existingData: Record<string, unknown> | null
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  let updateData = buildEntityData('', entityType, data, linkedEntities);
  
  // Remove organization_id from update
  delete updateData.organization_id;
  
  // For incremental updates, only include changed fields
  if (isIncremental && existingData) {
    const changedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && value !== null && value !== existingData[key]) {
        changedData[key] = value;
      }
    }
    updateData = changedData;
  }
  
  // If no changes, skip
  if (Object.keys(updateData).length === 0) {
    return { data: existingData || undefined };
  }
  
  const tableName = getTableName(entityType);
  const { data: updated, error } = await supabase
    .from(tableName)
    .update(updateData)
    .eq('id', entityId)
    .select()
    .single();
  
  if (error) {
    return { error: error.message };
  }
  
  return { data: updated as Record<string, unknown> };
}

function getTableName(entityType: EntityType): 'members' | 'advisors' | 'leads' | 'plans' | 'memberships' {
  switch (entityType) {
    case 'member': return 'members';
    case 'advisor': return 'advisors';
    case 'lead': return 'leads';
    case 'plan': return 'plans';
    case 'membership': return 'memberships';
  }
}

function buildEntityData(
  organizationId: string,
  entityType: EntityType,
  data: Record<string, string>,
  linkedEntities: Record<string, string | null>
): Record<string, unknown> {
  const baseData: Record<string, unknown> = {};
  
  if (organizationId) {
    baseData.organization_id = organizationId;
  }
  
  switch (entityType) {
    case 'member':
      return {
        ...baseData,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email?.toLowerCase(),
        phone: data.phone || null,
        date_of_birth: parseDate(data.date_of_birth),
        gender: data.gender || null,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postal_code || null,
        member_number: data.member_number || null,
        status: data.status || 'pending',
        plan_name: data.plan_name || null,
        plan_type: data.plan_type || null,
        effective_date: parseDate(data.effective_date),
        termination_date: parseDate(data.termination_date),
        monthly_share: parseNumber(data.monthly_share),
        advisor_id: linkedEntities.advisor_id || null,
      };
      
    case 'advisor':
      return {
        ...baseData,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email?.toLowerCase(),
        phone: data.phone || null,
        agency_name: data.agency_name || null,
        license_number: data.license_number || null,
        license_states: data.license_states ? data.license_states.split(',').map(s => s.trim()) : [],
        npn: data.npn || null,
        advisor_code: data.advisor_code || null,
        status: data.status || 'pending',
        commission_tier: data.commission_tier || null,
      };
      
    case 'lead':
      return {
        ...baseData,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email?.toLowerCase(),
        phone: data.phone || null,
        state: data.state || null,
        source: data.source || null,
        campaign: data.campaign || null,
        status: data.status || 'new',
        notes: data.notes || null,
        household_size: parseNumber(data.household_size),
        advisor_id: linkedEntities.advisor_id || null,
      };
      
    case 'plan':
      return {
        ...baseData,
        name: data.name,
        code: data.code,
        description: data.description || null,
        product_line: data.product_line || null,
        coverage_category: data.coverage_category || null,
        network_type: data.network_type || null,
        tier: data.tier || null,
        monthly_share: parseNumber(data.monthly_share),
        enrollment_fee: parseNumber(data.enrollment_fee),
        iua_amount: parseNumber(data.iua_amount),
        is_active: parseBoolean(data.is_active) ?? true,
      };
      
    case 'membership':
      return {
        ...baseData,
        member_id: linkedEntities.member_id,
        plan_id: linkedEntities.plan_id,
        advisor_id: linkedEntities.advisor_id || null,
        membership_number: data.membership_number || null,
        status: data.status || 'pending',
        effective_date: parseDate(data.effective_date) || new Date().toISOString().split('T')[0],
        end_date: parseDate(data.end_date),
        billing_amount: parseNumber(data.billing_amount),
      };
      
    default:
      return baseData;
  }
}

function parseDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  
  // MM/DD/YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try Date.parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return null;
}

function parseNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseBoolean(value: string | undefined | null): boolean | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (['true', 'yes', '1', 'y'].includes(lower)) return true;
  if (['false', 'no', '0', 'n'].includes(lower)) return false;
  return null;
}
