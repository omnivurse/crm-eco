/**
 * CRM Supabase Query Functions
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';
import type {
  CrmModule,
  CrmField,
  CrmLayout,
  CrmView,
  CrmRecord,
  CrmNote,
  CrmNoteWithAuthor,
  CrmTask,
  CrmTaskWithAssignee,
  CrmAuditLog,
  CrmAuditLogWithActor,
  CrmImportJob,
  CrmProfile,
  ViewFilter,
  ViewSort,
  ModuleStats,
  CrmDealStage,
  CrmStageHistory,
  CrmStageHistoryWithUser,
  CrmRecordLink,
  CrmLinkedRecord,
  CrmAttachment,
  CrmAttachmentWithAuthor,
  TimelineEvent,
  FilterOperator,
} from './types';

// ============================================================================
// Date Range Helper Functions
// ============================================================================

interface DateRange {
  start: Date;
  end: Date;
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDateRangeForPreset(preset: FilterOperator, nValue?: number): DateRange | null {
  const now = new Date();
  const today = getStartOfDay(now);

  switch (preset) {
    case 'today':
      return { start: today, end: getEndOfDay(now) };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: getEndOfDay(yesterday) };
    }

    case 'this_week': {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - day); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return { start: startOfWeek, end: getEndOfDay(endOfWeek) };
    }

    case 'last_week': {
      const startOfLastWeek = new Date(today);
      const day = startOfLastWeek.getDay();
      startOfLastWeek.setDate(startOfLastWeek.getDate() - day - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      return { start: startOfLastWeek, end: getEndOfDay(endOfLastWeek) };
    }

    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfMonth, end: getEndOfDay(endOfMonth) };
    }

    case 'last_month': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfLastMonth, end: getEndOfDay(endOfLastMonth) };
    }

    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      const endOfQuarter = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      return { start: startOfQuarter, end: getEndOfDay(endOfQuarter) };
    }

    case 'last_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const lastQuarter = quarter === 0 ? 3 : quarter - 1;
      const year = quarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const startOfLastQuarter = new Date(year, lastQuarter * 3, 1);
      const endOfLastQuarter = new Date(year, lastQuarter * 3 + 3, 0);
      return { start: startOfLastQuarter, end: getEndOfDay(endOfLastQuarter) };
    }

    case 'this_year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      return { start: startOfYear, end: getEndOfDay(endOfYear) };
    }

    case 'last_year': {
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
      return { start: startOfLastYear, end: getEndOfDay(endOfLastYear) };
    }

    case 'last_n_days': {
      const n = nValue || 7;
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - n);
      return { start: startDate, end: getEndOfDay(now) };
    }

    case 'next_n_days': {
      const n = nValue || 7;
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + n);
      return { start: today, end: getEndOfDay(endDate) };
    }

    default:
      return null;
  }
}

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
    // Determine the field path - system fields vs custom fields in data jsonb
    const isSystemField = ['title', 'status', 'stage', 'email', 'phone', 'created_at', 'updated_at', 'owner_id'].includes(filter.field);
    const fieldPath = isSystemField ? filter.field : `data->>${filter.field}`;

    switch (filter.operator) {
      // Basic comparison operators
      case 'equals':
        query = query.eq(fieldPath, filter.value);
        break;
      case 'not_equals':
        query = query.neq(fieldPath, filter.value);
        break;
      case 'contains':
        query = query.ilike(fieldPath, `%${filter.value}%`);
        break;
      case 'starts_with':
        query = query.ilike(fieldPath, `${filter.value}%`);
        break;
      case 'ends_with':
        query = query.ilike(fieldPath, `%${filter.value}`);
        break;

      // Numeric/date comparison operators
      case 'gt':
        query = query.gt(fieldPath, filter.value);
        break;
      case 'gte':
        query = query.gte(fieldPath, filter.value);
        break;
      case 'lt':
        query = query.lt(fieldPath, filter.value);
        break;
      case 'lte':
        query = query.lte(fieldPath, filter.value);
        break;

      // Null checks
      case 'is_null':
        query = query.is(fieldPath, null);
        break;
      case 'is_not_null':
        query = query.not(fieldPath, 'is', null);
        break;

      // Array operators
      case 'in':
        if (Array.isArray(filter.value)) {
          query = query.in(fieldPath, filter.value);
        } else if (typeof filter.value === 'string') {
          query = query.in(fieldPath, filter.value.split(',').map(v => v.trim()));
        }
        break;
      case 'not_in':
        if (Array.isArray(filter.value)) {
          query = query.not(fieldPath, 'in', `(${filter.value.join(',')})`);
        } else if (typeof filter.value === 'string') {
          const values = filter.value.split(',').map(v => v.trim());
          query = query.not(fieldPath, 'in', `(${values.join(',')})`);
        }
        break;

      // Between operator (requires secondValue)
      case 'between':
        if (filter.value && filter.secondValue) {
          query = query.gte(fieldPath, filter.value).lte(fieldPath, filter.secondValue);
        }
        break;

      // Date preset operators
      case 'today':
      case 'yesterday':
      case 'this_week':
      case 'last_week':
      case 'this_month':
      case 'last_month':
      case 'this_quarter':
      case 'last_quarter':
      case 'this_year':
      case 'last_year': {
        const range = getDateRangeForPreset(filter.operator);
        if (range) {
          query = query.gte(fieldPath, range.start.toISOString()).lte(fieldPath, range.end.toISOString());
        }
        break;
      }

      // Last/Next N days (uses filter.value as N)
      case 'last_n_days':
      case 'next_n_days': {
        const nValue = typeof filter.value === 'number' ? filter.value : parseInt(filter.value as string, 10);
        const range = getDateRangeForPreset(filter.operator, isNaN(nValue) ? 7 : nValue);
        if (range) {
          query = query.gte(fieldPath, range.start.toISOString()).lte(fieldPath, range.end.toISOString());
        }
        break;
      }
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

export async function getNotesForRecord(recordId: string): Promise<CrmNoteWithAuthor[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_notes')
    .select(`
      *,
      author:profiles!crm_notes_created_by_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CrmNoteWithAuthor[];
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
  const oneWeekAgoISO = oneWeekAgo.toISOString();

  const { data: modules } = await supabase
    .from('crm_modules')
    .select('id, key, name, name_plural')
    .eq('org_id', orgId)
    .eq('is_enabled', true);

  if (!modules || modules.length === 0) return [];

  // Legacy table mappings for backwards compatibility
  const legacyTableMap: Record<string, string> = {
    leads: 'leads',
    contacts: 'members',
    deals: 'members',
  };

  // Build all queries in parallel - eliminates N+1 problem
  const moduleIds = modules.map(m => m.id);

  // Single query to get all CRM record counts grouped by module
  const [crmTotalsResult, crmThisWeekResult] = await Promise.all([
    // Total counts per module
    supabase.rpc('count_records_by_modules', { module_ids: moduleIds }).catch(() => ({ data: null })),
    // This week counts per module
    supabase.rpc('count_records_by_modules_since', {
      module_ids: moduleIds,
      since_date: oneWeekAgoISO
    }).catch(() => ({ data: null })),
  ]);

  // Build counts map from RPC results, fallback to individual queries if RPC doesn't exist
  let crmTotalsMap: Record<string, number> = {};
  let crmThisWeekMap: Record<string, number> = {};

  if (crmTotalsResult.data && crmThisWeekResult.data) {
    // RPC functions exist - use aggregated results
    (crmTotalsResult.data as Array<{ module_id: string; count: number }>).forEach(r => {
      crmTotalsMap[r.module_id] = r.count;
    });
    (crmThisWeekResult.data as Array<{ module_id: string; count: number }>).forEach(r => {
      crmThisWeekMap[r.module_id] = r.count;
    });
  } else {
    // Fallback: run all module queries in parallel (still better than sequential)
    const queries = modules.flatMap(m => [
      supabase
        .from('crm_records')
        .select('*', { count: 'exact', head: true })
        .eq('module_id', m.id)
        .then(r => ({ moduleId: m.id, type: 'total' as const, count: r.count || 0 })),
      supabase
        .from('crm_records')
        .select('*', { count: 'exact', head: true })
        .eq('module_id', m.id)
        .gte('created_at', oneWeekAgoISO)
        .then(r => ({ moduleId: m.id, type: 'week' as const, count: r.count || 0 })),
    ]);

    const results = await Promise.all(queries);
    results.forEach(r => {
      if (r.type === 'total') crmTotalsMap[r.moduleId] = r.count;
      else crmThisWeekMap[r.moduleId] = r.count;
    });
  }

  // Legacy queries in parallel
  const legacyQueries = modules
    .filter(m => legacyTableMap[m.key])
    .flatMap(m => {
      const table = legacyTableMap[m.key];
      return [
        supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .then(r => ({ moduleKey: m.key, type: 'total' as const, count: r.count || 0 }))
          .catch(() => ({ moduleKey: m.key, type: 'total' as const, count: 0 })),
        supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('created_at', oneWeekAgoISO)
          .then(r => ({ moduleKey: m.key, type: 'week' as const, count: r.count || 0 }))
          .catch(() => ({ moduleKey: m.key, type: 'week' as const, count: 0 })),
      ];
    });

  const legacyTotalsMap: Record<string, number> = {};
  const legacyThisWeekMap: Record<string, number> = {};

  if (legacyQueries.length > 0) {
    const legacyResults = await Promise.all(legacyQueries);
    legacyResults.forEach(r => {
      if (r.type === 'total') legacyTotalsMap[r.moduleKey] = r.count;
      else legacyThisWeekMap[r.moduleKey] = r.count;
    });
  }

  // Combine results
  return modules.map(m => ({
    moduleKey: m.key,
    moduleName: m.name_plural || m.name + 's',
    totalRecords: (crmTotalsMap[m.id] || 0) + (legacyTotalsMap[m.key] || 0),
    createdThisWeek: (crmThisWeekMap[m.id] || 0) + (legacyThisWeekMap[m.key] || 0),
  }));
}

export interface AtRiskDeal {
  id: string;
  name: string;
  value: number;
  stage: string;
  daysInStage: number;
  ownerId: string | null;
  ownerName: string | null;
  reason: 'stale' | 'overdue_task' | 'no_activity';
}

export async function getAtRiskDeals(orgId: string, limit: number = 5): Promise<AtRiskDeal[]> {
  const supabase = await createCrmClient();

  // Get deals module
  const { data: dealsModule } = await supabase
    .from('crm_modules')
    .select('id')
    .eq('org_id', orgId)
    .eq('key', 'deals')
    .single();

  if (!dealsModule) return [];

  // Get deals that have been in the same stage for more than 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: records } = await supabase
    .from('crm_records')
    .select(`
      id,
      data,
      owner_id,
      stage_updated_at,
      profiles:owner_id (full_name)
    `)
    .eq('module_id', dealsModule.id)
    .lt('stage_updated_at', sevenDaysAgo.toISOString())
    .not('data->stage', 'in', '("Closed Won","Closed Lost","closed_won","closed_lost")')
    .order('stage_updated_at', { ascending: true })
    .limit(limit);

  if (!records) return [];

  const now = new Date();
  return records.map(record => {
    const data = record.data as Record<string, unknown>;
    const stageUpdated = record.stage_updated_at ? new Date(record.stage_updated_at) : new Date(record.stage_updated_at || now);
    const daysInStage = Math.floor((now.getTime() - stageUpdated.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: record.id,
      name: (data.name || data.deal_name || 'Unnamed Deal') as string,
      value: (data.value || data.amount || data.deal_value || 0) as number,
      stage: (data.stage || data.deal_stage || 'Unknown') as string,
      daysInStage,
      ownerId: record.owner_id,
      ownerName: (() => {
        const profiles = record.profiles as { full_name: string } | { full_name: string }[] | null;
        if (!profiles) return null;
        if (Array.isArray(profiles)) return profiles[0]?.full_name || null;
        return profiles.full_name || null;
      })(),
      reason: 'stale' as const,
    };
  });
}

export async function getTodaysTasks(userId: string): Promise<CrmTask[]> {
  const supabase = await createCrmClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data } = await supabase
    .from('crm_tasks')
    .select('*')
    .eq('assigned_to', userId)
    .neq('status', 'completed')
    .gte('due_at', today.toISOString())
    .lt('due_at', tomorrow.toISOString())
    .order('due_at', { ascending: true });

  return (data || []) as CrmTask[];
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

  const now = new Date();
  const moduleKeys = ['leads', 'contacts', 'deals'] as const;

  // Build all month ranges
  const monthRanges = Array.from({ length: monthsBack }, (_, i) => {
    const idx = monthsBack - 1 - i;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - idx, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - idx + 1, 0, 23, 59, 59);
    return {
      monthName: startOfMonth.toLocaleString('en-US', { month: 'short' }),
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString(),
    };
  });

  // Execute ALL queries in parallel - eliminates nested loop N+1 problem
  const allQueries = monthRanges.flatMap((range, monthIndex) =>
    moduleKeys.map(key => {
      if (!moduleMap[key]) {
        return Promise.resolve({ monthIndex, key, count: 0 });
      }
      return supabase
        .from('crm_records')
        .select('*', { count: 'exact', head: true })
        .eq('module_id', moduleMap[key])
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .then(r => ({ monthIndex, key, count: r.count || 0 }));
    })
  );

  const queryResults = await Promise.all(allQueries);

  // Build results from parallel query responses
  const results: MonthlyRecordCounts[] = monthRanges.map((range, idx) => ({
    month: range.monthName,
    leads: 0,
    contacts: 0,
    deals: 0,
  }));

  queryResults.forEach(({ monthIndex, key, count }) => {
    results[monthIndex][key] = count;
  });

  return results;
}

// ============================================================================
// Cached Dashboard Queries - For expensive operations
// ============================================================================

/**
 * Cached version of getModuleStats - revalidates every 60 seconds
 * Use this for dashboard to avoid repeated expensive queries
 */
export const getCachedModuleStats = (orgId: string) =>
  unstable_cache(
    async () => getModuleStats(orgId),
    [`module-stats-${orgId}`],
    { revalidate: 60, tags: [`org-${orgId}`, 'module-stats'] }
  )();

/**
 * Cached version of getMonthlyRecordCounts - revalidates every 5 minutes
 * Data changes slowly so longer cache is acceptable
 */
export const getCachedMonthlyRecordCounts = (orgId: string, monthsBack: number = 6) =>
  unstable_cache(
    async () => getMonthlyRecordCounts(orgId, monthsBack),
    [`monthly-counts-${orgId}-${monthsBack}`],
    { revalidate: 300, tags: [`org-${orgId}`, 'monthly-counts'] }
  )();

/**
 * Cached version of getAtRiskDeals - revalidates every 2 minutes
 */
export const getCachedAtRiskDeals = (orgId: string, limit: number = 5) =>
  unstable_cache(
    async () => getAtRiskDeals(orgId, limit),
    [`at-risk-deals-${orgId}-${limit}`],
    { revalidate: 120, tags: [`org-${orgId}`, 'at-risk-deals'] }
  )();

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

// ============================================================================
// Deal Stages Queries
// ============================================================================

export async function getDealStages(orgId: string): Promise<CrmDealStage[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_deal_stages')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmDealStage[];
}

export async function getDealStageByKey(orgId: string, key: string): Promise<CrmDealStage | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_deal_stages')
    .select('*')
    .eq('org_id', orgId)
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmDealStage | null;
}

// ============================================================================
// Stage History Queries
// ============================================================================

export async function getStageHistory(recordId: string): Promise<CrmStageHistoryWithUser[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_deal_stage_history')
    .select(`
      *,
      changed_by_profile:profiles!crm_deal_stage_history_changed_by_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((item: Record<string, unknown>) => ({
    ...item,
    changed_by_name: (item.changed_by_profile as { full_name: string } | null)?.full_name || null,
  })) as CrmStageHistoryWithUser[];
}

// ============================================================================
// Record Links Queries
// ============================================================================

export async function getRecordLinks(recordId: string): Promise<CrmLinkedRecord[]> {
  const supabase = await createCrmClient();

  // Run both queries in parallel
  const [outboundResult, inboundResult] = await Promise.all([
    // Get outbound links (this record -> other)
    supabase
      .from('crm_record_links')
      .select(`
        id,
        link_type,
        is_primary,
        created_at,
        target_record:crm_records!crm_record_links_target_record_id_fkey(
          id,
          title,
          module:crm_modules!crm_records_module_id_fkey(
            key,
            name
          )
        )
      `)
      .eq('source_record_id', recordId),
    // Get inbound links (other -> this record)
    supabase
      .from('crm_record_links')
      .select(`
        id,
        link_type,
        is_primary,
        created_at,
        source_record:crm_records!crm_record_links_source_record_id_fkey(
          id,
          title,
          module:crm_modules!crm_records_module_id_fkey(
            key,
            name
          )
        )
      `)
      .eq('target_record_id', recordId),
  ]);

  if (outboundResult.error) throw outboundResult.error;
  if (inboundResult.error) throw inboundResult.error;

  const outbound = outboundResult.data;
  const inbound = inboundResult.data;

  // Transform both link arrays using map instead of loops
  const outboundLinks: CrmLinkedRecord[] = (outbound || [])
    .map(link => {
      const record = link.target_record as unknown as { id: string; title: string; module: { key: string; name: string } };
      if (!record) return null;
      return {
        link_id: link.id,
        link_type: link.link_type,
        is_primary: link.is_primary,
        direction: 'outbound' as const,
        record_id: record.id,
        record_title: record.title,
        record_module_key: record.module?.key || '',
        record_module_name: record.module?.name || '',
        created_at: link.created_at,
      };
    })
    .filter((x): x is CrmLinkedRecord => x !== null);

  const inboundLinks: CrmLinkedRecord[] = (inbound || [])
    .map(link => {
      const record = link.source_record as unknown as { id: string; title: string; module: { key: string; name: string } };
      if (!record) return null;
      return {
        link_id: link.id,
        link_type: link.link_type,
        is_primary: link.is_primary,
        direction: 'inbound' as const,
        record_id: record.id,
        record_title: record.title,
        record_module_key: record.module?.key || '',
        record_module_name: record.module?.name || '',
        created_at: link.created_at,
      };
    })
    .filter((x): x is CrmLinkedRecord => x !== null);

  // Combine and sort by created_at desc
  return [...outboundLinks, ...inboundLinks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ============================================================================
// Attachments Queries
// ============================================================================

export async function getAttachmentsForRecord(recordId: string): Promise<CrmAttachmentWithAuthor[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_attachments')
    .select(`
      *,
      author:profiles!crm_attachments_created_by_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CrmAttachmentWithAuthor[];
}

// ============================================================================
// Timeline Queries
// ============================================================================

export async function getTimelineForRecord(recordId: string, limit = 50): Promise<TimelineEvent[]> {
  const supabase = await createCrmClient();
  
  // Fetch all timeline sources in parallel
  const [stageHistory, tasks, notes, attachments, auditLogs] = await Promise.all([
    // Stage history
    supabase
      .from('crm_deal_stage_history')
      .select(`
        *,
        changed_by_profile:profiles!crm_deal_stage_history_changed_by_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit),
    
    // Tasks/Activities
    supabase
      .from('crm_tasks')
      .select(`
        *,
        assignee:profiles!crm_tasks_assigned_to_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit),
    
    // Notes
    supabase
      .from('crm_notes')
      .select(`
        *,
        author:profiles!crm_notes_created_by_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit),
    
    // Attachments
    supabase
      .from('crm_attachments')
      .select(`
        *,
        author:profiles!crm_attachments_created_by_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit),
    
    // Audit logs
    supabase
      .from('crm_audit_log')
      .select(`
        *,
        actor:profiles!crm_audit_log_actor_id_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('entity', 'crm_records')
      .eq('entity_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const events: TimelineEvent[] = [];

  // Add stage history
  if (stageHistory.data) {
    for (const item of stageHistory.data) {
      events.push({
        id: item.id,
        type: 'stage_change',
        timestamp: item.created_at,
        data: {
          ...item,
          changed_by_name: (item.changed_by_profile as { full_name: string } | null)?.full_name || null,
        } as CrmStageHistoryWithUser,
      });
    }
  }

  // Add tasks/activities
  if (tasks.data) {
    for (const item of tasks.data) {
      events.push({
        id: item.id,
        type: 'activity',
        timestamp: item.created_at,
        data: item as CrmTaskWithAssignee,
      });
    }
  }

  // Add notes
  if (notes.data) {
    for (const item of notes.data) {
      events.push({
        id: item.id,
        type: 'note',
        timestamp: item.created_at,
        data: item as CrmNoteWithAuthor,
      });
    }
  }

  // Add attachments
  if (attachments.data) {
    for (const item of attachments.data) {
      events.push({
        id: item.id,
        type: 'attachment',
        timestamp: item.created_at,
        data: item as CrmAttachmentWithAuthor,
      });
    }
  }

  // Add audit logs
  if (auditLogs.data) {
    for (const item of auditLogs.data) {
      events.push({
        id: item.id,
        type: 'audit',
        timestamp: item.created_at,
        data: item as CrmAuditLogWithActor,
      });
    }
  }

  // Sort by timestamp descending and limit
  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ============================================================================
// Activities Queries
// ============================================================================

export async function getActivitiesForRecord(recordId: string): Promise<CrmTaskWithAssignee[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_tasks')
    .select(`
      *,
      assignee:profiles!crm_tasks_assigned_to_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CrmTaskWithAssignee[];
}

export async function getAllActivities(orgId: string, options?: {
  activityType?: string;
  status?: string;
  limit?: number;
}): Promise<CrmTaskWithAssignee[]> {
  const supabase = await createCrmClient();
  
  let query = supabase
    .from('crm_tasks')
    .select(`
      *,
      assignee:profiles!crm_tasks_assigned_to_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('org_id', orgId);

  if (options?.activityType) {
    query = query.eq('activity_type', options.activityType);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as CrmTaskWithAssignee[];
}
