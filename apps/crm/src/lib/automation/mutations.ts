/**
 * CRM Automation Pack - Mutation Functions
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  CrmWorkflow,
  CrmAssignmentRule,
  CrmScoringRules,
  CrmCadence,
  CrmSlaPolicy,
  CrmWebform,
  CrmMacro,
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
// Workflow Mutations
// ============================================================================

export async function createWorkflow(
  input: Omit<CrmWorkflow, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmWorkflow> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_workflows')
    .insert({
      ...input,
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmWorkflow;
}

export async function updateWorkflow(
  workflowId: string,
  updates: Partial<CrmWorkflow>
): Promise<CrmWorkflow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_workflows')
    .update(updates)
    .eq('id', workflowId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmWorkflow;
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_workflows')
    .delete()
    .eq('id', workflowId);

  if (error) throw error;
}

export async function toggleWorkflow(workflowId: string, isEnabled: boolean): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_workflows')
    .update({ is_enabled: isEnabled })
    .eq('id', workflowId);

  if (error) throw error;
}

// ============================================================================
// Assignment Rule Mutations
// ============================================================================

export async function createAssignmentRule(
  input: Omit<CrmAssignmentRule, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmAssignmentRule> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_assignment_rules')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as CrmAssignmentRule;
}

export async function updateAssignmentRule(
  ruleId: string,
  updates: Partial<CrmAssignmentRule>
): Promise<CrmAssignmentRule> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_assignment_rules')
    .update(updates)
    .eq('id', ruleId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmAssignmentRule;
}

export async function deleteAssignmentRule(ruleId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_assignment_rules')
    .delete()
    .eq('id', ruleId);

  if (error) throw error;
}

// ============================================================================
// Scoring Rule Mutations
// ============================================================================

export async function createScoringRules(
  input: Omit<CrmScoringRules, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmScoringRules> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_scoring_rules')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as CrmScoringRules;
}

export async function updateScoringRules(
  id: string,
  updates: Partial<CrmScoringRules>
): Promise<CrmScoringRules> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_scoring_rules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CrmScoringRules;
}

export async function deleteScoringRules(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_scoring_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// Cadence Mutations
// ============================================================================

export async function createCadence(
  input: Omit<CrmCadence, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmCadence> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_cadences')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as CrmCadence;
}

export async function updateCadence(
  cadenceId: string,
  updates: Partial<CrmCadence>
): Promise<CrmCadence> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_cadences')
    .update(updates)
    .eq('id', cadenceId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmCadence;
}

export async function deleteCadence(cadenceId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_cadences')
    .delete()
    .eq('id', cadenceId);

  if (error) throw error;
}

// ============================================================================
// SLA Policy Mutations
// ============================================================================

export async function createSlaPolicy(
  input: Omit<CrmSlaPolicy, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmSlaPolicy> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_sla_policies')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as CrmSlaPolicy;
}

export async function updateSlaPolicy(
  policyId: string,
  updates: Partial<CrmSlaPolicy>
): Promise<CrmSlaPolicy> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_sla_policies')
    .update(updates)
    .eq('id', policyId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmSlaPolicy;
}

export async function deleteSlaPolicy(policyId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_sla_policies')
    .delete()
    .eq('id', policyId);

  if (error) throw error;
}

// ============================================================================
// Webform Mutations
// ============================================================================

export async function createWebform(
  input: Omit<CrmWebform, 'id' | 'created_at' | 'updated_at' | 'submit_count'>
): Promise<CrmWebform> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_webforms')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as CrmWebform;
}

export async function updateWebform(
  webformId: string,
  updates: Partial<CrmWebform>
): Promise<CrmWebform> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_webforms')
    .update(updates)
    .eq('id', webformId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmWebform;
}

export async function deleteWebform(webformId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_webforms')
    .delete()
    .eq('id', webformId);

  if (error) throw error;
}

// ============================================================================
// Macro Mutations
// ============================================================================

export async function createMacro(
  input: Omit<CrmMacro, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmMacro> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_macros')
    .insert({
      ...input,
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmMacro;
}

export async function updateMacro(
  macroId: string,
  updates: Partial<CrmMacro>
): Promise<CrmMacro> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_macros')
    .update(updates)
    .eq('id', macroId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmMacro;
}

export async function deleteMacro(macroId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_macros')
    .delete()
    .eq('id', macroId);

  if (error) throw error;
}

export async function toggleMacro(macroId: string, isEnabled: boolean): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_macros')
    .update({ is_enabled: isEnabled })
    .eq('id', macroId);

  if (error) throw error;
}

// ============================================================================
// Notification Mutations
// ============================================================================

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('crm_notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}
