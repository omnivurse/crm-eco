'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/crm/queries';
import { revalidatePath } from 'next/cache';

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
  pendingChanges: number;
}

export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  code: string;
  description: string | null;
  vendor_type: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  connection_type: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
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
  valid_rows: number;
  new_records: number;
  updated_records: number;
  created_at: string;
  completed_at: string | null;
  vendor_name: string;
  vendor_id: string;
}

export interface VendorChange {
  id: string;
  vendor_id: string;
  file_id: string | null;
  change_type: string;
  entity_type: string;
  entity_id: string | null;
  external_id: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  change_data: Record<string, unknown>;
  status: string;
  severity: string;
  detected_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  vendor_name: string;
}

export interface VendorConnector {
  id: string;
  vendor_id: string;
  name: string;
  connector_type: string;
  is_active: boolean;
  schedule_type: string;
  schedule_cron: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  config: Record<string, unknown>;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  created_at: string;
  vendor_name: string;
}

// ============================================================================
// AUTH HELPERS
// ============================================================================
async function verifyCrmAccess() {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Not authenticated');
  }
  return profile;
}

async function verifyCrmAdminAccess() {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Not authenticated');
  }
  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    throw new Error('Not authorized - admin or manager access required');
  }
  return profile;
}

// ============================================================================
// VENDOR STATS
// ============================================================================
export async function getVendorStats(): Promise<ActionResult<VendorStats>> {
  try {
    const profile = await verifyCrmAccess();
    const supabase = await createServerSupabaseClient() as any;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalResult,
      activeResult,
      filesResult,
      changesResult,
      pendingResult,
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
      supabase
        .from('vendor_changes')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', profile.organization_id)
        .eq('status', 'pending'),
    ]);

    return {
      success: true,
      data: {
        totalVendors: totalResult.count || 0,
        activeVendors: activeResult.count || 0,
        filesInProgress: filesResult.count || 0,
        changesLast7Days: changesResult.count || 0,
        pendingChanges: pendingResult.count || 0,
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
    const profile = await verifyCrmAccess();
    const supabase = await createServerSupabaseClient() as any;

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
    const profile = await verifyCrmAccess();
    const supabase = await createServerSupabaseClient() as any;

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
  status?: string;
  limit?: number;
}): Promise<ActionResult<RecentJob[]>> {
  try {
    const profile = await verifyCrmAccess();
    const supabase = await createServerSupabaseClient() as any;

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
        valid_rows,
        new_records,
        updated_records,
        created_at,
        completed_at,
        vendor_id,
        vendors!inner(name)
      `)
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false })
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

    const jobs = (data || []).map((item: Record<string, unknown>) => ({
      id: item.id,
      file_name: item.file_name,
      file_type: item.file_type,
      status: item.status,
      total_rows: item.total_rows,
      processed_rows: item.processed_rows,
      error_rows: item.error_rows,
      valid_rows: item.valid_rows,
      new_records: item.new_records,
      updated_records: item.updated_records,
      created_at: item.created_at,
      completed_at: item.completed_at,
      vendor_id: item.vendor_id,
      vendor_name: (item.vendors as Record<string, unknown>)?.name || 'Unknown',
    }));

    return {
      success: true,
      data: jobs as RecentJob[],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recent jobs',
    };
  }
}

// ============================================================================
// VENDOR CHANGES
// ============================================================================
export async function getVendorChanges(options?: {
  vendorId?: string;
  status?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ changes: VendorChange[]; total: number }>> {
  try {
    const profile = await verifyCrmAccess();
    const supabase = await createServerSupabaseClient() as any;

    let query = supabase
      .from('vendor_changes')
      .select(`
        *,
        vendors!inner(name)
      `, { count: 'exact' })
      .eq('org_id', profile.organization_id)
      .order('detected_at', { ascending: false });

    if (options?.vendorId) {
      query = query.eq('vendor_id', options.vendorId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.severity) {
      query = query.eq('severity', options.severity);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options?.limit || 20) - 1);
    } else if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const changes = (data || []).map((item: Record<string, unknown>) => ({
      ...item,
      vendor_name: (item.vendors as Record<string, unknown>)?.name || 'Unknown',
    }));

    return {
      success: true,
      data: {
        changes: changes as VendorChange[],
        total: count || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch vendor changes',
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
    const profile = await verifyCrmAdminAccess();
    const supabase = await createServerSupabaseClient() as any;

    const statusMap: Record<'approve' | 'reject' | 'ignore', 'approved' | 'rejected' | 'ignored'> = {
      approve: 'approved',
      reject: 'rejected',
      ignore: 'ignored',
    };

    const { error } = await supabase
      .from('vendor_changes')
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

    revalidatePath('/crm/vendors');
    revalidatePath('/crm/vendors/changes');
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
    const profile = await verifyCrmAdminAccess();
    const supabase = await createServerSupabaseClient() as any;

    const statusMap: Record<'approve' | 'reject' | 'ignore', 'approved' | 'rejected' | 'ignored'> = {
      approve: 'approved',
      reject: 'rejected',
      ignore: 'ignored',
    };

    const { error, count } = await supabase
      .from('vendor_changes')
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

    revalidatePath('/crm/vendors');
    revalidatePath('/crm/vendors/changes');
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
    const profile = await verifyCrmAccess();
    const supabase = await createServerSupabaseClient() as any;

    let query = supabase
      .from('vendor_connectors')
      .select(`
        *,
        vendors!inner(name)
      `)
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const connectors = (data || []).map((item: Record<string, unknown>) => ({
      ...item,
      vendor_name: (item.vendors as Record<string, unknown>)?.name || 'Unknown',
    }));

    return {
      success: true,
      data: connectors as VendorConnector[],
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
    const profile = await verifyCrmAdminAccess();
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase
      .from('vendor_files')
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

    revalidatePath('/crm/vendors');
    revalidatePath('/crm/vendors/jobs');
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

// ============================================================================
// VENDOR CRUD
// ============================================================================
export async function createVendor(params: {
  name: string;
  code: string;
  vendor_type: string;
  description?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
}): Promise<ActionResult<{ vendorId: string }>> {
  try {
    const profile = await verifyCrmAdminAccess();
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        org_id: profile.organization_id,
        name: params.name,
        code: params.code.toUpperCase(),
        vendor_type: params.vendor_type,
        description: params.description || null,
        contact_name: params.contact_name || null,
        contact_email: params.contact_email || null,
        contact_phone: params.contact_phone || null,
        website_url: params.website_url || null,
        status: 'active',
        created_by: profile.id,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'A vendor with this code already exists',
        };
      }
      throw error;
    }

    revalidatePath('/crm/vendors');
    return {
      success: true,
      data: { vendorId: data.id },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create vendor',
    };
  }
}

export async function updateVendor(
  id: string,
  params: Partial<{
    name: string;
    code: string;
    vendor_type: string;
    description: string;
    status: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    website_url: string;
  }>
): Promise<ActionResult> {
  try {
    const profile = await verifyCrmAdminAccess();
    const supabase = await createServerSupabaseClient() as any;

    const updateData: Record<string, unknown> = { updated_by: profile.id };
    if (params.name !== undefined) updateData.name = params.name;
    if (params.code !== undefined) updateData.code = params.code.toUpperCase();
    if (params.vendor_type !== undefined) updateData.vendor_type = params.vendor_type;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.contact_name !== undefined) updateData.contact_name = params.contact_name;
    if (params.contact_email !== undefined) updateData.contact_email = params.contact_email;
    if (params.contact_phone !== undefined) updateData.contact_phone = params.contact_phone;
    if (params.website_url !== undefined) updateData.website_url = params.website_url;

    const { error } = await supabase
      .from('vendors')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'A vendor with this code already exists',
        };
      }
      throw error;
    }

    revalidatePath('/crm/vendors');
    revalidatePath(`/crm/vendors/${id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update vendor',
    };
  }
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  try {
    const profile = await verifyCrmAdminAccess();
    const supabase = await createServerSupabaseClient() as any;

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) {
      throw error;
    }

    revalidatePath('/crm/vendors');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete vendor',
    };
  }
}
