/**
 * CRM Approvals - Rules Engine
 * Evaluates approval rules to determine if an action requires approval
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  CrmApprovalRule,
  ApprovalRuleTriggerType,
  ApprovalCondition,
  ApprovalRuleConditions,
  RuleMatchResult,
} from './types';

// ============================================================================
// Supabase Client
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
          } catch {
            // Server Component context
          }
        },
      },
    }
  );
}

// ============================================================================
// Get Approval Rules
// ============================================================================

/**
 * Get all enabled approval rules for a module
 */
export async function getApprovalRulesForModule(
  moduleId: string,
  triggerType?: ApprovalRuleTriggerType
): Promise<CrmApprovalRule[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('crm_approval_rules')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_enabled', true)
    .order('priority', { ascending: true });
  
  if (triggerType) {
    query = query.eq('trigger_type', triggerType);
  }
  
  const { data } = await query;
  
  return (data || []) as CrmApprovalRule[];
}

/**
 * Get a single approval rule by ID
 */
export async function getApprovalRule(ruleId: string): Promise<CrmApprovalRule | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_approval_rules')
    .select('*')
    .eq('id', ruleId)
    .single();
  
  return data as CrmApprovalRule | null;
}

// ============================================================================
// Condition Evaluation
// ============================================================================

/**
 * Evaluate a single condition against record data
 */
function evaluateCondition(
  condition: ApprovalCondition,
  recordData: Record<string, unknown>
): boolean {
  const fieldValue = recordData[condition.field];
  const compareValue = condition.value;
  
  switch (condition.operator) {
    case 'eq':
      return fieldValue === compareValue;
    
    case 'neq':
      return fieldValue !== compareValue;
    
    case 'gt':
      if (typeof fieldValue === 'number' && typeof compareValue === 'number') {
        return fieldValue > compareValue;
      }
      return Number(fieldValue) > Number(compareValue);
    
    case 'gte':
      if (typeof fieldValue === 'number' && typeof compareValue === 'number') {
        return fieldValue >= compareValue;
      }
      return Number(fieldValue) >= Number(compareValue);
    
    case 'lt':
      if (typeof fieldValue === 'number' && typeof compareValue === 'number') {
        return fieldValue < compareValue;
      }
      return Number(fieldValue) < Number(compareValue);
    
    case 'lte':
      if (typeof fieldValue === 'number' && typeof compareValue === 'number') {
        return fieldValue <= compareValue;
      }
      return Number(fieldValue) <= Number(compareValue);
    
    case 'contains':
      if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
        return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
      }
      return false;
    
    case 'in':
      if (Array.isArray(compareValue)) {
        return compareValue.includes(fieldValue as string);
      }
      return false;
    
    case 'not_in':
      if (Array.isArray(compareValue)) {
        return !compareValue.includes(fieldValue as string);
      }
      return true;
    
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    
    default:
      return false;
  }
}

/**
 * Evaluate all conditions with AND/OR logic
 */
function evaluateConditions(
  conditions: ApprovalRuleConditions,
  recordData: Record<string, unknown>
): boolean {
  // If no conditions, rule always matches
  if (!conditions.conditions || conditions.conditions.length === 0) {
    return true;
  }
  
  const logic = conditions.logic || 'AND';
  
  if (logic === 'AND') {
    return conditions.conditions.every(c => evaluateCondition(c, recordData));
  } else {
    return conditions.conditions.some(c => evaluateCondition(c, recordData));
  }
}

/**
 * Check if a trigger matches the rule's trigger config
 */
function checkTriggerMatch(
  rule: CrmApprovalRule,
  triggerType: ApprovalRuleTriggerType,
  triggerContext: {
    field?: string;
    stage_from?: string | null;
    stage_to?: string;
    oldValue?: unknown;
    newValue?: unknown;
  }
): boolean {
  if (rule.trigger_type !== triggerType) {
    return false;
  }
  
  const config = rule.trigger_config;
  
  switch (triggerType) {
    case 'stage_transition':
      // Check stage_from and stage_to if specified
      if (config.stage_from && config.stage_from !== '*') {
        if (config.stage_from !== triggerContext.stage_from) {
          return false;
        }
      }
      if (config.stage_to && config.stage_to !== '*') {
        if (config.stage_to !== triggerContext.stage_to) {
          return false;
        }
      }
      return true;
    
    case 'field_change':
      // Check if the changed field matches
      if (config.field && config.field !== triggerContext.field) {
        return false;
      }
      return true;
    
    case 'field_threshold':
      // Check if field matches and value exceeds threshold
      if (config.field && config.field !== triggerContext.field) {
        return false;
      }
      if (config.threshold !== undefined) {
        const newVal = Number(triggerContext.newValue);
        if (isNaN(newVal) || newVal <= config.threshold) {
          return false;
        }
      }
      return true;
    
    case 'record_create':
    case 'record_delete':
      // No additional config to check
      return true;
    
    default:
      return false;
  }
}

// ============================================================================
// Main Rule Evaluation
// ============================================================================

/**
 * Evaluate approval rules to find matching rules
 */
export async function evaluateApprovalRules(
  orgId: string,
  moduleId: string,
  triggerType: ApprovalRuleTriggerType,
  recordData: Record<string, unknown>,
  triggerContext: {
    field?: string;
    stage_from?: string | null;
    stage_to?: string;
    oldValue?: unknown;
    newValue?: unknown;
  } = {}
): Promise<RuleMatchResult[]> {
  // Get all rules for this module and trigger type
  const rules = await getApprovalRulesForModule(moduleId, triggerType);
  
  // Filter to rules for this org
  const orgRules = rules.filter(r => r.org_id === orgId);
  
  const matches: RuleMatchResult[] = [];
  
  for (const rule of orgRules) {
    // Check trigger match
    if (!checkTriggerMatch(rule, triggerType, triggerContext)) {
      continue;
    }
    
    // Evaluate conditions
    if (!evaluateConditions(rule.conditions, recordData)) {
      continue;
    }
    
    // Rule matches
    matches.push({
      ruleId: rule.id,
      processId: rule.process_id,
      ruleName: rule.name,
    });
  }
  
  return matches;
}

/**
 * Check if any approval is required for an action
 * Returns the first matching rule's process, or null if no approval needed
 */
export async function checkApprovalRequired(
  orgId: string,
  moduleId: string,
  triggerType: ApprovalRuleTriggerType,
  recordData: Record<string, unknown>,
  triggerContext: {
    field?: string;
    stage_from?: string | null;
    stage_to?: string;
    oldValue?: unknown;
    newValue?: unknown;
  } = {}
): Promise<RuleMatchResult | null> {
  const matches = await evaluateApprovalRules(
    orgId,
    moduleId,
    triggerType,
    recordData,
    triggerContext
  );
  
  // Return first match (highest priority)
  return matches.length > 0 ? matches[0] : null;
}

// ============================================================================
// Rule CRUD Operations
// ============================================================================

/**
 * Create a new approval rule
 */
export async function createApprovalRule(
  data: Omit<CrmApprovalRule, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; rule?: CrmApprovalRule; error?: string }> {
  const supabase = await createClient();
  
  const { data: rule, error } = await supabase
    .from('crm_approval_rules')
    .insert({
      org_id: data.org_id,
      module_id: data.module_id,
      process_id: data.process_id,
      name: data.name,
      description: data.description,
      trigger_type: data.trigger_type,
      trigger_config: data.trigger_config,
      conditions: data.conditions,
      priority: data.priority ?? 100,
      is_enabled: data.is_enabled ?? true,
      created_by: data.created_by,
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, rule: rule as CrmApprovalRule };
}

/**
 * Update an approval rule
 */
export async function updateApprovalRule(
  ruleId: string,
  data: Partial<CrmApprovalRule>
): Promise<{ success: boolean; rule?: CrmApprovalRule; error?: string }> {
  const supabase = await createClient();
  
  const { data: rule, error } = await supabase
    .from('crm_approval_rules')
    .update({
      name: data.name,
      description: data.description,
      trigger_type: data.trigger_type,
      trigger_config: data.trigger_config,
      conditions: data.conditions,
      priority: data.priority,
      is_enabled: data.is_enabled,
    })
    .eq('id', ruleId)
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, rule: rule as CrmApprovalRule };
}

/**
 * Delete an approval rule
 */
export async function deleteApprovalRule(
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('crm_approval_rules')
    .delete()
    .eq('id', ruleId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}
