'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { Vendor, VendorFile, VendorChange, VendorConnector } from '@crm-eco/lib/types';

// ============================================================================
// TYPES
// ============================================================================
export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface VendorStats {
  totalVendors: number;
  activeVendors: number;
  filesInProgress: number;
  changesLast7Days: number;
}

export interface VendorWithStats extends Vendor {
  filesCount?: number;
  changesCount?: number;
}

export interface RecentJob {
  id: string;
  file_name: string;
  file_type: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  error_rows: number;
  created_at: string;
  vendor_name: string;
}

export interface RecentChange {
  id: string;
  change_type: string;
  entity_type: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  status: string;
  severity: string;
  detected_at: string;
  vendor_name: string;
}

// ============================================================================
// AUTH HELPERS
// ============================================================================
async function verifyAccess() {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Not authenticated');
  }
  // All authenticated users can view vendors
  return profile;
}

async function verifyAdminAccess() {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Not authenticated');
  }
  if (!['owner', 'admin'].includes(profile.role)) {
    throw new Error('Not authorized - admin access required');
  }
  return profile;
}

// ============================================================================
// VENDOR STATS
// ============================================================================
export async function getVendorStats(): Promise<ActionResult<VendorStats>> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    // Fetch stats using parallel queries
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalResult,
      activeResult,
      filesResult,
      changesResult,
    ] = await Promise.all([
      supabase
        .from('vendors')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', profile.organization_id),
      supabase
        .from('vendors')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', profile.organization_id)
        .eq('status', 'active'),
      supabase
        .from('vendor_files')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', profile.organization_id)
        .in('status', ['pending', 'validating', 'processing']),
      supabase
        .from('vendor_changes')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', profile.organization_id)
        .gte('detected_at', sevenDaysAgo.toISOString()),
    ]);

    return {
      success: true,
      data: {
        totalVendors: totalResult.count || 0,
        activeVendors: activeResult.count || 0,
        filesInProgress: filesResult.count || 0,
        changesLast7Days: changesResult.count || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch vendor stats',
    };
  }
}

// ============================================================================
// VENDOR LIST
// ============================================================================
export async function getVendors(options?: {
  status?: string;
  search?: string;
  limit?: number;
}): Promise<ActionResult<VendorWithStats[]>> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('vendors')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      query = query.or(`name.ilike.%${options.search}%,code.ilike.%${options.search}%`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: (data || []) as VendorWithStats[],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch vendors',
    };
  }
}

// ============================================================================
// VENDOR DETAIL
// ============================================================================
export async function getVendorById(id: string): Promise<ActionResult<Vendor>> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: data as Vendor,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch vendor',
    };
  }
}

// ============================================================================
// RECENT JOBS
// ============================================================================
export async function getRecentJobs(options?: {
  vendorId?: string;
  limit?: number;
}): Promise<ActionResult<RecentJob[]>> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('vendor_files')
      .select(`
        id,
        file_name,
        file_type,
        status,
        total_rows,
        processed_rows,
        error_rows,
        created_at,
        vendors!inner(name)
      `)
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(options?.limit || 10);

    if (options?.vendorId) {
      query = query.eq('vendor_id', options.vendorId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const jobs = (data || []).map((item: any) => ({
      id: item.id,
      file_name: item.file_name,
      file_type: item.file_type,
      status: item.status,
      total_rows: item.total_rows,
      processed_rows: item.processed_rows,
      error_rows: item.error_rows,
      created_at: item.created_at,
      vendor_name: item.vendors?.name || 'Unknown',
    }));

    return {
      success: true,
      data: jobs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recent jobs',
    };
  }
}

// ============================================================================
// RECENT CHANGES
// ============================================================================
export async function getRecentChanges(options?: {
  vendorId?: string;
  status?: string;
  limit?: number;
}): Promise<ActionResult<RecentChange[]>> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('vendor_changes')
      .select(`
        id,
        change_type,
        entity_type,
        field_changed,
        old_value,
        new_value,
        status,
        severity,
        detected_at,
        vendors!inner(name)
      `)
      .eq('org_id', profile.organization_id)
      .order('detected_at', { ascending: false })
      .limit(options?.limit || 10);

    if (options?.vendorId) {
      query = query.eq('vendor_id', options.vendorId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const changes = (data || []).map((item: any) => ({
      id: item.id,
      change_type: item.change_type,
      entity_type: item.entity_type,
      field_changed: item.field_changed,
      old_value: item.old_value,
      new_value: item.new_value,
      status: item.status,
      severity: item.severity,
      detected_at: item.detected_at,
      vendor_name: item.vendors?.name || 'Unknown',
    }));

    return {
      success: true,
      data: changes,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recent changes',
    };
  }
}

// ============================================================================
// CHANGE REVIEW
// ============================================================================
export async function reviewChange(
  changeId: string,
  action: 'approve' | 'reject' | 'ignore',
  notes?: string
): Promise<ActionResult> {
  try {
    const profile = await verifyAdminAccess();
    const supabase = await createServerSupabaseClient();

    const statusMap: Record<'approve' | 'reject' | 'ignore', 'approved' | 'rejected' | 'ignored'> = {
      approve: 'approved',
      reject: 'rejected',
      ignore: 'ignored',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
      .from('vendor_changes') as any)
      .update({
        status: statusMap[action],
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        applied_at: action === 'approve' ? new Date().toISOString() : null,
      })
      .eq('id', changeId)
      .eq('org_id', profile.organization_id);

    if (error) {
      throw error;
    }

    revalidatePath('/vendors');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to review change',
    };
  }
}

export async function bulkReviewChanges(
  changeIds: string[],
  action: 'approve' | 'reject' | 'ignore'
): Promise<ActionResult<{ processed: number; failed: number }>> {
  try {
    const profile = await verifyAdminAccess();
    const supabase = await createServerSupabaseClient();

    const statusMap: Record<'approve' | 'reject' | 'ignore', 'approved' | 'rejected' | 'ignored'> = {
      approve: 'approved',
      reject: 'rejected',
      ignore: 'ignored',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase
      .from('vendor_changes') as any)
      .update({
        status: statusMap[action],
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        applied_at: action === 'approve' ? new Date().toISOString() : null,
      })
      .in('id', changeIds)
      .eq('org_id', profile.organization_id);

    if (error) {
      throw error;
    }

    revalidatePath('/vendors');
    return {
      success: true,
      data: {
        processed: count || 0,
        failed: changeIds.length - (count || 0),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk review changes',
    };
  }
}

// ============================================================================
// CONNECTORS
// ============================================================================
export async function getConnectors(vendorId?: string): Promise<ActionResult<VendorConnector[]>> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('vendor_connectors')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: (data || []) as VendorConnector[],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch connectors',
    };
  }
}

// ============================================================================
// FILE UPLOAD
// ============================================================================
export async function createVendorFile(params: {
  vendorId: string;
  fileName: string;
  fileType: 'enrollment' | 'pricing' | 'roster' | 'termination' | 'change' | 'other';
  fileFormat: string;
  fileSizeBytes: number;
  storagePath: string;
  duplicateStrategy?: 'skip' | 'update' | 'error';
  detectChanges?: boolean;
}): Promise<ActionResult<{ fileId: string }>> {
  try {
    const profile = await verifyAdminAccess();
    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from('vendor_files') as any)
      .insert({
        org_id: profile.organization_id,
        vendor_id: params.vendorId,
        file_name: params.fileName,
        file_type: params.fileType,
        file_format: params.fileFormat,
        file_size_bytes: params.fileSizeBytes,
        storage_path: params.storagePath,
        upload_source: 'manual',
        status: 'pending',
        duplicate_strategy: params.duplicateStrategy || 'update',
        detect_changes: params.detectChanges ?? true,
        uploaded_by: profile.id,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/vendors');
    return {
      success: true,
      data: { fileId: data.id },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create vendor file record',
    };
  }
}
