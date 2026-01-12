/**
 * CRM Supabase Query Functions
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  CrmModule,
  CrmField,
  CrmLayout,
  CrmView,
  CrmRecord,
  CrmNote,
  CrmTask,
  CrmAuditLog,
  CrmImportJob,
  CrmProfile,
  ViewFilter,
  ViewSort,
  ModuleStats,
} from './types';

// ============================================================================
// Supabase Client Helper
// ============================================================================

export async function createCrmClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
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
            // Server Component context - cookies are read-only
          }
        },
      },
    }
  );
}

// ============================================================================
// User & Profile Queries
// ============================================================================

export async function getCurrentProfile(): Promise<CrmProfile | null> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return profile as CrmProfile | null;
}

export async function getOrganizationProfiles(orgId: string): Promise<CrmProfile[]> {
  const supabase = await createCrmClient();
  
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', orgId)
    .not('crm_role', 'is', null)
    .order('full_name');

  return (data || []) as CrmProfile[];
}

// ============================================================================
// Module Queries
// ============================================================================

export async function getModules(orgId: string): Promise<CrmModule[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_modules')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_enabled', true)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmModule[];
}

export async function getModuleByKey(orgId: string, key: string): Promise<CrmModule | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_modules')
    .select('*')
    .eq('org_id', orgId)
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmModule | null;
}

export async function getAllModules(orgId: string): Promise<CrmModule[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_modules')
    .select('*')
    .eq('org_id', orgId)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmModule[];
}

// ============================================================================
// Field Queries
// ============================================================================

export async function getFieldsForModule(moduleId: string): Promise<CrmField[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_fields')
    .select('*')
    .eq('module_id', moduleId)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmField[];
}

export async function getFieldsBySection(moduleId: string): Promise<Record<string, CrmField[]>> {
  const fields = await getFieldsForModule(moduleId);
  
  return fields.reduce((acc, field) => {
    const section = field.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {} as Record<string, CrmField[]>);
}

// ============================================================================
// Layout Queries
// ============================================================================

export async function getDefaultLayout(moduleId: string): Promise<CrmLayout | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_layouts')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmLayout | null;
}

export async function getLayoutsForModule(moduleId: string): Promise<CrmLayout[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_layouts')
    .select('*')
    .eq('module_id', moduleId)
    .order('name');

  if (error) throw error;
  return (data || []) as CrmLayout[];
}

// ============================================================================
// View Queries
// ============================================================================

export async function getViewsForModule(moduleId: string): Promise<CrmView[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_views')
    .select('*')
    .eq('module_id', moduleId)
    .order('name');

  if (error) throw error;
  return (data || []) as CrmView[];
}

export async function getDefaultView(moduleId: string): Promise<CrmView | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_views')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmView | null;
}

// ============================================================================
// Record Queries
// ============================================================================

export interface RecordQueryOptions {
  moduleId: string;
  page?: number;
  pageSize?: number;
  filters?: ViewFilter[];
  sort?: ViewSort[];
  search?: string;
}

export interface RecordQueryResult {
  records: CrmRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getRecords(options: RecordQueryOptions): Promise<RecordQueryResult> {
  const supabase = await createCrmClient();
  const { moduleId, page = 1, pageSize = 25, filters = [], sort = [], search } = options;

  let query = supabase
    .from('crm_records')
    .select('*', { count: 'exact' })
    .eq('module_id', moduleId);

  // Apply filters
  for (const filter of filters) {
    switch (filter.operator) {
      case 'equals':
        query = query.eq(`data->>${filter.field}`, filter.value);
        break;
      case 'not_equals':
        query = query.neq(`data->>${filter.field}`, filter.value);
        break;
      case 'contains':
        query = query.ilike(`data->>${filter.field}`, `%${filter.value}%`);
        break;
      case 'starts_with':
        query = query.ilike(`data->>${filter.field}`, `${filter.value}%`);
        break;
      case 'is_null':
        query = query.is(`data->>${filter.field}`, null);
        break;
      case 'is_not_null':
        query = query.not(`data->>${filter.field}`, 'is', null);
        break;
    }
  }

  // Apply search
  if (search) {
    query = query.textSearch('search', search);
  }

  // Apply sorting
  if (sort.length > 0) {
    for (const s of sort) {
      if (['title', 'status', 'stage', 'email', 'phone', 'created_at', 'updated_at'].includes(s.field)) {
        query = query.order(s.field, { ascending: s.direction === 'asc' });
      } else {
        // For custom fields, we need to sort by jsonb path
        query = query.order(`data->>${s.field}`, { ascending: s.direction === 'asc' });
      }
    }
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    records: (data || []) as CrmRecord[],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

export async function getRecordById(recordId: string): Promise<CrmRecord | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmRecord | null;
}

export async function getRecordWithModule(recordId: string): Promise<{ record: CrmRecord; module: CrmModule } | null> {
  const supabase = await createCrmClient();
  
  const { data: record, error: recordError } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (recordError || !record) return null;

  const { data: module, error: moduleError } = await supabase
    .from('crm_modules')
    .select('*')
    .eq('id', record.module_id)
    .single();

  if (moduleError || !module) return null;

  return {
    record: record as CrmRecord,
    module: module as CrmModule,
  };
}

// ============================================================================
// Notes Queries
// ============================================================================

export async function getNotesForRecord(recordId: string): Promise<CrmNote[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_notes')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CrmNote[];
}

// ============================================================================
// Tasks Queries
// ============================================================================

export async function getTasksForRecord(recordId: string): Promise<CrmTask[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_tasks')
    .select('*')
    .eq('record_id', recordId)
    .order('due_at', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data || []) as CrmTask[];
}

export async function getMyTasks(profileId: string, includeCompleted = false): Promise<CrmTask[]> {
  const supabase = await createCrmClient();
  
  let query = supabase
    .from('crm_tasks')
    .select('*')
    .eq('assigned_to', profileId);

  if (!includeCompleted) {
    query = query.neq('status', 'completed');
  }

  const { data, error } = await query.order('due_at', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data || []) as CrmTask[];
}

export async function getUpcomingTasks(profileId: string, days = 7): Promise<CrmTask[]> {
  const supabase = await createCrmClient();
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  const { data, error } = await supabase
    .from('crm_tasks')
    .select('*')
    .eq('assigned_to', profileId)
    .neq('status', 'completed')
    .lte('due_at', futureDate.toISOString())
    .order('due_at', { ascending: true });

  if (error) throw error;
  return (data || []) as CrmTask[];
}

// ============================================================================
// Audit Log Queries
// ============================================================================

export async function getAuditLogForRecord(recordId: string, limit = 50): Promise<CrmAuditLog[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_audit_log')
    .select('*')
    .eq('entity', 'crm_records')
    .eq('entity_id', recordId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmAuditLog[];
}

export async function getRecentActivity(orgId: string, limit = 20): Promise<CrmAuditLog[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_audit_log')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmAuditLog[];
}

// ============================================================================
// Import Queries
// ============================================================================

export async function getRecentImportJobs(orgId: string, limit = 10): Promise<CrmImportJob[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_import_jobs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmImportJob[];
}

export async function getImportJob(jobId: string): Promise<CrmImportJob | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_import_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmImportJob | null;
}

// ============================================================================
// Dashboard Stats Queries
// ============================================================================

export async function getModuleStats(orgId: string): Promise<ModuleStats[]> {
  const supabase = await createCrmClient();
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: modules } = await supabase
    .from('crm_modules')
    .select('id, key, name')
    .eq('org_id', orgId)
    .eq('is_enabled', true);

  if (!modules) return [];

  const stats: ModuleStats[] = [];

  for (const module of modules) {
    const { count: total } = await supabase
      .from('crm_records')
      .select('*', { count: 'exact', head: true })
      .eq('module_id', module.id);

    const { count: thisWeek } = await supabase
      .from('crm_records')
      .select('*', { count: 'exact', head: true })
      .eq('module_id', module.id)
      .gte('created_at', oneWeekAgo.toISOString());

    stats.push({
      moduleKey: module.key,
      moduleName: module.name,
      totalRecords: total || 0,
      createdThisWeek: thisWeek || 0,
    });
  }

  return stats;
}

// ============================================================================
// Reporting Queries
// ============================================================================

export interface MonthlyRecordCounts {
  month: string;
  leads: number;
  contacts: number;
  deals: number;
}

export async function getMonthlyRecordCounts(orgId: string, monthsBack: number = 6): Promise<MonthlyRecordCounts[]> {
  const supabase = await createCrmClient();

  // Get module IDs
  const { data: modules } = await supabase
    .from('crm_modules')
    .select('id, key')
    .eq('org_id', orgId)
    .in('key', ['leads', 'contacts', 'deals']);

  if (!modules || modules.length === 0) {
    return [];
  }

  const moduleMap: Record<string, string> = {};
  modules.forEach(m => { moduleMap[m.key] = m.id; });

  const results: MonthlyRecordCounts[] = [];
  const now = new Date();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthName = startOfMonth.toLocaleString('en-US', { month: 'short' });

    const counts = { month: monthName, leads: 0, contacts: 0, deals: 0 };

    // Count for each module type
    for (const key of ['leads', 'contacts', 'deals'] as const) {
      if (moduleMap[key]) {
        const { count } = await supabase
          .from('crm_records')
          .select('*', { count: 'exact', head: true })
          .eq('module_id', moduleMap[key])
          .gte('created_at', startOfMonth.toISOString())
          .lte('created_at', endOfMonth.toISOString());
        counts[key] = count || 0;
      }
    }

    results.push(counts);
  }

  return results;
}

export interface ReportSummary {
  totalContacts: number;
  totalLeads: number;
  totalDeals: number;
  totalAccounts: number;
  leadsThisWeek: number;
  contactsThisWeek: number;
  dealsClosedThisWeek: number;
  conversionRate: number;
}

export async function getReportSummary(orgId: string): Promise<ReportSummary> {
  const stats = await getModuleStats(orgId);
  
  const totalContacts = stats.find(s => s.moduleKey === 'contacts')?.totalRecords || 0;
  const totalLeads = stats.find(s => s.moduleKey === 'leads')?.totalRecords || 0;
  const totalDeals = stats.find(s => s.moduleKey === 'deals')?.totalRecords || 0;
  const totalAccounts = stats.find(s => s.moduleKey === 'accounts')?.totalRecords || 0;
  
  const leadsThisWeek = stats.find(s => s.moduleKey === 'leads')?.createdThisWeek || 0;
  const contactsThisWeek = stats.find(s => s.moduleKey === 'contacts')?.createdThisWeek || 0;
  const dealsClosedThisWeek = stats.find(s => s.moduleKey === 'deals')?.createdThisWeek || 0;
  
  // Calculate conversion rate (converted leads / total leads)
  const conversionRate = totalLeads > 0 ? Math.round((totalContacts / totalLeads) * 100) : 0;

  return {
    totalContacts,
    totalLeads,
    totalDeals,
    totalAccounts,
    leadsThisWeek,
    contactsThisWeek,
    dealsClosedThisWeek,
    conversionRate,
  };
}
