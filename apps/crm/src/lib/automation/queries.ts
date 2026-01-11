/**
 * CRM Automation Pack - Query Functions
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  CrmWorkflow,
  CrmAssignmentRule,
  CrmScoringRules,
  CrmCadence,
  CrmCadenceEnrollment,
  CrmSlaPolicy,
  CrmWebform,
  CrmNotification,
  CrmAutomationRun,
} from './types';

// ============================================================================
// Supabase Client Helper
// ============================================================================

async function createClient() {
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
          } catch {}
        },
      },
    }
  );
}

// ============================================================================
// Workflow Queries
// ============================================================================

export async function getWorkflows(orgId: string, moduleId?: string): Promise<CrmWorkflow[]> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_workflows')
    .select('*')
    .eq('org_id', orgId)
    .order('priority', { ascending: true });

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CrmWorkflow[];
}

export async function getWorkflowById(workflowId: string): Promise<CrmWorkflow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_workflows')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmWorkflow | null;
}

// ============================================================================
// Assignment Rule Queries
// ============================================================================

export async function getAssignmentRules(orgId: string, moduleId?: string): Promise<CrmAssignmentRule[]> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_assignment_rules')
    .select('*')
    .eq('org_id', orgId)
    .order('priority', { ascending: true });

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CrmAssignmentRule[];
}

// ============================================================================
// Scoring Rule Queries
// ============================================================================

export async function getScoringRules(orgId: string, moduleId?: string): Promise<CrmScoringRules[]> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_scoring_rules')
    .select('*')
    .eq('org_id', orgId);

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CrmScoringRules[];
}

// ============================================================================
// Cadence Queries
// ============================================================================

export async function getCadences(orgId: string, moduleId?: string): Promise<CrmCadence[]> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_cadences')
    .select('*')
    .eq('org_id', orgId);

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CrmCadence[];
}

export async function getCadenceEnrollments(recordId: string): Promise<CrmCadenceEnrollment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_cadence_enrollments')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CrmCadenceEnrollment[];
}

// ============================================================================
// SLA Policy Queries
// ============================================================================

export async function getSlaPolicies(orgId: string, moduleId?: string): Promise<CrmSlaPolicy[]> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_sla_policies')
    .select('*')
    .eq('org_id', orgId);

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CrmSlaPolicy[];
}

// ============================================================================
// Webform Queries
// ============================================================================

export async function getWebforms(orgId: string, moduleId?: string): Promise<CrmWebform[]> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_webforms')
    .select('*')
    .eq('org_id', orgId);

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CrmWebform[];
}

export async function getWebformBySlug(orgId: string, slug: string): Promise<CrmWebform | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_webforms')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmWebform | null;
}

// ============================================================================
// Notification Queries
// ============================================================================

export async function getNotifications(userId: string, unreadOnly = false): Promise<CrmNotification[]> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CrmNotification[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('crm_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

// ============================================================================
// Automation Run Queries
// ============================================================================

export async function getAutomationRuns(
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: string;
    source?: string;
    workflowId?: string;
    recordId?: string;
  }
): Promise<CrmAutomationRun[]> {
  const supabase = await createClient();

  let query = supabase
    .from('crm_automation_runs')
    .select('*')
    .eq('org_id', orgId)
    .order('started_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.source) {
    query = query.eq('source', options.source);
  }
  if (options?.workflowId) {
    query = query.eq('workflow_id', options.workflowId);
  }
  if (options?.recordId) {
    query = query.eq('record_id', options.recordId);
  }

  query = query.range(
    options?.offset || 0,
    (options?.offset || 0) + (options?.limit || 50) - 1
  );

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CrmAutomationRun[];
}

export async function getAutomationRunById(runId: string): Promise<CrmAutomationRun | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_automation_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmAutomationRun | null;
}

// ============================================================================
// Stats Queries
// ============================================================================

export async function getAutomationStats(orgId: string): Promise<{
  activeWorkflows: number;
  assignmentRules: number;
  activeWebforms: number;
  runsToday: number;
}> {
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: activeWorkflows },
    { count: assignmentRules },
    { count: activeWebforms },
    { count: runsToday },
  ] = await Promise.all([
    supabase
      .from('crm_workflows')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_enabled', true),
    supabase
      .from('crm_assignment_rules')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_enabled', true),
    supabase
      .from('crm_webforms')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_enabled', true),
    supabase
      .from('crm_automation_runs')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('started_at', today.toISOString()),
  ]);

  return {
    activeWorkflows: activeWorkflows || 0,
    assignmentRules: assignmentRules || 0,
    activeWebforms: activeWebforms || 0,
    runsToday: runsToday || 0,
  };
}
