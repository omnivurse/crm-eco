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
  
  // Get outbound links (this record -> other)
  const { data: outbound, error: outboundError } = await supabase
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
    .eq('source_record_id', recordId);

  if (outboundError) throw outboundError;

  // Get inbound links (other -> this record)
  const { data: inbound, error: inboundError } = await supabase
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
    .eq('target_record_id', recordId);

  if (inboundError) throw inboundError;

  const results: CrmLinkedRecord[] = [];

  // Transform outbound links
  for (const link of outbound || []) {
    const record = link.target_record as unknown as { id: string; title: string; module: { key: string; name: string } };
    if (record) {
      results.push({
        link_id: link.id,
        link_type: link.link_type,
        is_primary: link.is_primary,
        direction: 'outbound',
        record_id: record.id,
        record_title: record.title,
        record_module_key: record.module?.key || '',
        record_module_name: record.module?.name || '',
        created_at: link.created_at,
      });
    }
  }

  // Transform inbound links
  for (const link of inbound || []) {
    const record = link.source_record as unknown as { id: string; title: string; module: { key: string; name: string } };
    if (record) {
      results.push({
        link_id: link.id,
        link_type: link.link_type,
        is_primary: link.is_primary,
        direction: 'inbound',
        record_id: record.id,
        record_title: record.title,
        record_module_key: record.module?.key || '',
        record_module_name: record.module?.name || '',
        created_at: link.created_at,
      });
    }
  }

  // Sort by created_at desc
  return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
