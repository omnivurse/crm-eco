/**
 * CRM Validation Rules - Execution Engine
 * Server-side validation that cannot be bypassed
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  ValidationRule,
  ValidationResult,
  ValidationContext,
  FieldValidationError,
  SingleRuleResult,
  FormatConfig,
  RangeConfig,
  ComparisonConfig,
  StageTriggers,
} from './types';
import {
  FORMAT_PATTERNS,
  isFieldEmpty,
  normalizeConditions,
} from './types';
import type { ConditionGroup, Condition, ConditionOperator } from '../automation/types';

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
// Load Validation Rules
// ============================================================================

/**
 * Get all validation rules for a module
 */
export async function getValidationRules(
  moduleId: string,
  trigger?: string
): Promise<ValidationRule[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('crm_validation_rules')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_enabled', true)
    .order('priority', { ascending: true });
  
  if (trigger) {
    query = query.contains('applies_on', [trigger]);
  }
  
  const { data } = await query;
  return (data || []) as ValidationRule[];
}

/**
 * Get validation rules for a specific stage transition
 */
export async function getStageValidationRules(
  moduleId: string,
  fromStage: string | null,
  toStage: string
): Promise<ValidationRule[]> {
  const rules = await getValidationRules(moduleId, 'stage_change');
  
  return rules.filter(rule => {
    const triggers = rule.stage_triggers as StageTriggers | null;
    if (!triggers) return true; // No stage triggers = applies to all
    
    const fromMatches = !triggers.from_stages?.length || 
      (fromStage && triggers.from_stages.includes(fromStage));
    const toMatches = !triggers.to_stages?.length || 
      triggers.to_stages.includes(toStage);
    
    return fromMatches && toMatches;
  });
}

// ============================================================================
// Condition Evaluation
// ============================================================================

function getFieldValue(record: Record<string, unknown>, fieldKey: string): unknown {
  // Check system fields first
  if (fieldKey in record) {
    return record[fieldKey];
  }
  // Check data object
  const data = record.data as Record<string, unknown> | undefined;
  if (data && fieldKey in data) {
    return data[fieldKey];
  }
  return undefined;
}

function evaluateCondition(
  record: Record<string, unknown>,
  condition: Condition
): boolean {
  const value = getFieldValue(record, condition.field);
  const { operator, value: compareValue } = condition;
  
  switch (operator) {
    case 'eq':
      return value === compareValue;
    case 'ne':
      return value !== compareValue;
    case 'contains':
      return typeof value === 'string' && 
        value.toLowerCase().includes(String(compareValue).toLowerCase());
    case 'not_contains':
      return typeof value !== 'string' || 
        !value.toLowerCase().includes(String(compareValue).toLowerCase());
    case 'starts_with':
      return typeof value === 'string' && 
        value.toLowerCase().startsWith(String(compareValue).toLowerCase());
    case 'ends_with':
      return typeof value === 'string' && 
        value.toLowerCase().endsWith(String(compareValue).toLowerCase());
    case 'in':
      return Array.isArray(compareValue) && compareValue.includes(value);
    case 'not_in':
      return !Array.isArray(compareValue) || !compareValue.includes(value);
    case 'gt':
      return Number(value) > Number(compareValue);
    case 'gte':
      return Number(value) >= Number(compareValue);
    case 'lt':
      return Number(value) < Number(compareValue);
    case 'lte':
      return Number(value) <= Number(compareValue);
    case 'is_empty':
      return isFieldEmpty(value);
    case 'not_empty':
      return !isFieldEmpty(value);
    default:
      return true;
  }
}

function evaluateConditionGroup(
  record: Record<string, unknown>,
  group: ConditionGroup
): boolean {
  if (!group.conditions || group.conditions.length === 0) {
    return true; // No conditions = always applies
  }
  
  const results = group.conditions.map(condition => {
    if ('logic' in condition) {
      return evaluateConditionGroup(record, condition as ConditionGroup);
    }
    return evaluateCondition(record, condition as Condition);
  });
  
  if (group.logic === 'OR') {
    return results.some(r => r);
  }
  return results.every(r => r);
}

// ============================================================================
// Rule Evaluators
// ============================================================================

function evaluateRequiredIf(
  value: unknown,
  _config: Record<string, unknown>
): boolean {
  // If conditions are met (evaluated before calling this), field must have value
  return !isFieldEmpty(value);
}

function evaluateFormat(
  value: unknown,
  config: FormatConfig
): boolean {
  if (isFieldEmpty(value)) return true; // Empty values pass format check (use required_if for required)
  
  const strValue = String(value);
  
  if (config.format_type === 'regex' && config.pattern) {
    const regex = new RegExp(config.pattern, config.flags || '');
    return regex.test(strValue);
  }
  
  const pattern = FORMAT_PATTERNS[config.format_type as keyof typeof FORMAT_PATTERNS];
  if (pattern) {
    return pattern.test(strValue);
  }
  
  return true;
}

function evaluateRange(
  value: unknown,
  config: RangeConfig
): boolean {
  if (isFieldEmpty(value)) return true;
  
  let numValue: number;
  
  if (config.field_type === 'date' || config.field_type === 'datetime') {
    numValue = new Date(String(value)).getTime();
    const minNum = config.min ? new Date(String(config.min)).getTime() : -Infinity;
    const maxNum = config.max ? new Date(String(config.max)).getTime() : Infinity;
    
    const minPasses = config.min_exclusive ? numValue > minNum : numValue >= minNum;
    const maxPasses = config.max_exclusive ? numValue < maxNum : numValue <= maxNum;
    
    return minPasses && maxPasses;
  }
  
  numValue = Number(value);
  if (isNaN(numValue)) return false;
  
  const min = config.min !== undefined ? Number(config.min) : -Infinity;
  const max = config.max !== undefined ? Number(config.max) : Infinity;
  
  const minPasses = config.min_exclusive ? numValue > min : numValue >= min;
  const maxPasses = config.max_exclusive ? numValue < max : numValue <= max;
  
  return minPasses && maxPasses;
}

function evaluateComparison(
  value: unknown,
  config: ComparisonConfig,
  record: Record<string, unknown>
): boolean {
  if (isFieldEmpty(value)) return true;
  
  const compareValue = getFieldValue(record, config.compare_field);
  if (isFieldEmpty(compareValue)) return true;
  
  let a: number | string;
  let b: number | string;
  
  if (config.field_type === 'date') {
    a = new Date(String(value)).getTime();
    b = new Date(String(compareValue)).getTime();
  } else if (config.field_type === 'number') {
    a = Number(value);
    b = Number(compareValue);
  } else {
    a = String(value);
    b = String(compareValue);
  }
  
  switch (config.operator) {
    case 'eq':
      return a === b;
    case 'ne':
      return a !== b;
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
    default:
      return true;
  }
}

// ============================================================================
// Single Rule Evaluation
// ============================================================================

export function evaluateRule(
  record: Record<string, unknown>,
  rule: ValidationRule,
  context: ValidationContext
): SingleRuleResult {
  // Merge pending updates into record for evaluation
  const effectiveRecord = {
    ...record,
    data: {
      ...(record.data as Record<string, unknown> || {}),
      ...(context.pending_updates || {}),
    },
  };
  
  // Check if rule conditions are met
  const conditions = normalizeConditions(rule.conditions);
  const conditionsPass = evaluateConditionGroup(effectiveRecord, conditions);
  
  if (!conditionsPass) {
    return { rule_id: rule.id, result: 'skip' };
  }
  
  // Get target field value
  const value = getFieldValue(effectiveRecord, rule.target_field);
  const config = rule.config as Record<string, unknown>;
  
  let passed = false;
  
  switch (rule.rule_type) {
    case 'required_if':
      passed = evaluateRequiredIf(value, config);
      break;
    case 'format':
      passed = evaluateFormat(value, config as unknown as FormatConfig);
      break;
    case 'range':
      passed = evaluateRange(value, config as unknown as RangeConfig);
      break;
    case 'comparison':
      passed = evaluateComparison(value, config as unknown as ComparisonConfig, effectiveRecord);
      break;
    case 'unique':
      // Unique validation requires DB query - handled separately
      passed = true; // Assume pass for now, checked in validateRecord
      break;
    case 'custom':
      // Custom expressions not implemented in this version
      passed = true;
      break;
    default:
      passed = true;
  }
  
  if (passed) {
    return { rule_id: rule.id, result: 'pass' };
  }
  
  return {
    rule_id: rule.id,
    result: 'fail',
    error: {
      field: rule.target_field,
      rule_id: rule.id,
      rule_name: rule.name,
      rule_type: rule.rule_type,
      message: rule.error_message,
      value,
    },
  };
}

// ============================================================================
// Unique Validation (requires DB)
// ============================================================================

async function checkUniqueness(
  record: Record<string, unknown>,
  rule: ValidationRule
): Promise<boolean> {
  const value = getFieldValue(record, rule.target_field);
  if (isFieldEmpty(value)) return true;
  
  const supabase = await createClient();
  const recordId = record.id as string;
  const moduleId = rule.module_id;
  
  // Check if any other record has this value
  let query = supabase
    .from('crm_records')
    .select('id')
    .eq('module_id', moduleId)
    .neq('id', recordId);
  
  // For data fields, use JSONB containment
  if (rule.target_field.startsWith('data.')) {
    const fieldKey = rule.target_field.replace('data.', '');
    query = query.contains('data', { [fieldKey]: value });
  } else {
    // System field
    query = query.eq(rule.target_field, value as string);
  }
  
  const { data } = await query.limit(1);
  return !data || data.length === 0;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a record against all applicable rules
 */
export async function validateRecord(
  record: Record<string, unknown>,
  rules: ValidationRule[],
  context: ValidationContext = { trigger: 'update' }
): Promise<ValidationResult> {
  const errors: FieldValidationError[] = [];
  const passedRules: string[] = [];
  const skippedRules: string[] = [];
  
  for (const rule of rules) {
    // Handle unique validation separately
    if (rule.rule_type === 'unique') {
      const conditions = normalizeConditions(rule.conditions);
      const conditionsPass = evaluateConditionGroup(
        { ...record, data: { ...(record.data as Record<string, unknown> || {}), ...(context.pending_updates || {}) } },
        conditions
      );
      
      if (!conditionsPass) {
        skippedRules.push(rule.id);
        continue;
      }
      
      const isUnique = await checkUniqueness(record, rule);
      if (isUnique) {
        passedRules.push(rule.id);
      } else {
        errors.push({
          field: rule.target_field,
          rule_id: rule.id,
          rule_name: rule.name,
          rule_type: rule.rule_type,
          message: rule.error_message,
          value: getFieldValue(record, rule.target_field),
        });
      }
      continue;
    }
    
    const result = evaluateRule(record, rule, context);
    
    switch (result.result) {
      case 'pass':
        passedRules.push(rule.id);
        break;
      case 'skip':
        skippedRules.push(rule.id);
        break;
      case 'fail':
        if (result.error) {
          errors.push(result.error);
        }
        break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    passed_rules: passedRules,
    skipped_rules: skippedRules,
  };
}

// ============================================================================
// Log Validation Run
// ============================================================================

export async function logValidationRun(
  orgId: string,
  ruleId: string | null,
  recordId: string,
  trigger: string,
  result: 'pass' | 'fail' | 'skip',
  fieldValue?: unknown,
  errors: FieldValidationError[] = [],
  context: Record<string, unknown> = {}
): Promise<string | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('crm_validation_rule_runs')
    .insert({
      org_id: orgId,
      rule_id: ruleId,
      record_id: recordId,
      trigger,
      result,
      field_value: fieldValue !== undefined ? JSON.stringify(fieldValue) : null,
      errors,
      context,
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to log validation run:', error);
    return null;
  }
  
  return data.id;
}

// ============================================================================
// Combined Blueprint + Validation Check
// ============================================================================

/**
 * Run all validations for a stage transition
 * Returns combined result from blueprint requirements and validation rules
 */
export async function validateStageTransition(
  record: Record<string, unknown>,
  toStage: string,
  context: ValidationContext
): Promise<ValidationResult> {
  const moduleId = record.module_id as string;
  const fromStage = record.stage as string | null;
  
  // Get validation rules for this transition
  const rules = await getStageValidationRules(moduleId, fromStage, toStage);
  
  // Run validation
  const result = await validateRecord(record, rules, {
    ...context,
    from_stage: fromStage,
    to_stage: toStage,
  });
  
  // Log all rule runs
  const orgId = record.org_id as string;
  const recordId = record.id as string;
  
  for (const ruleId of result.passed_rules) {
    await logValidationRun(orgId, ruleId, recordId, 'stage_change', 'pass');
  }
  
  for (const ruleId of result.skipped_rules) {
    await logValidationRun(orgId, ruleId, recordId, 'stage_change', 'skip');
  }
  
  for (const error of result.errors) {
    await logValidationRun(
      orgId, 
      error.rule_id, 
      recordId, 
      'stage_change', 
      'fail',
      error.value,
      [error]
    );
  }
  
  return result;
}
