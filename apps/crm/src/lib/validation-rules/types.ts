/**
 * CRM Validation Rules - Type Definitions
 * Configurable field-level and cross-field validation
 */

import type { ConditionGroup, Condition } from '../automation/types';

// ============================================================================
// Rule Types
// ============================================================================

export type ValidationRuleType =
  | 'required_if'  // Field required when condition met
  | 'format'       // Regex/email/url/phone format validation
  | 'range'        // Min/max for numbers/dates
  | 'comparison'   // Compare to another field
  | 'unique'       // Must be unique within module
  | 'custom';      // Custom expression

export type ValidationTrigger = 'create' | 'update' | 'stage_change' | 'manual';

// ============================================================================
// Rule Configurations
// ============================================================================

export interface RequiredIfConfig {
  // No additional config needed - uses conditions to determine when required
}

export interface FormatConfig {
  format_type: 'email' | 'phone' | 'url' | 'regex' | 'alphanumeric' | 'numeric';
  pattern?: string;  // Custom regex pattern
  flags?: string;    // Regex flags (i, g, m)
}

export interface RangeConfig {
  min?: number | string;  // For dates, use ISO string
  max?: number | string;
  min_exclusive?: boolean;
  max_exclusive?: boolean;
  field_type?: 'number' | 'date' | 'datetime';
}

export interface ComparisonConfig {
  compare_field: string;  // Field key to compare against
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
  field_type?: 'number' | 'date' | 'string';
}

export interface UniqueConfig {
  scope_fields?: string[];  // Additional fields to scope uniqueness (e.g., org_id)
  case_sensitive?: boolean;
}

export interface CustomConfig {
  expression?: string;  // JavaScript-like expression
  function_name?: string;  // Named function to execute
}

export type RuleConfig =
  | RequiredIfConfig
  | FormatConfig
  | RangeConfig
  | ComparisonConfig
  | UniqueConfig
  | CustomConfig;

// ============================================================================
// Stage Triggers
// ============================================================================

export interface StageTriggers {
  from_stages?: string[];  // Apply when transitioning FROM these stages (empty = any)
  to_stages?: string[];    // Apply when transitioning TO these stages (empty = any)
}

// ============================================================================
// Validation Rule
// ============================================================================

export interface ValidationRule {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  description: string | null;
  rule_type: ValidationRuleType;
  target_field: string;
  conditions: ConditionGroup | Condition[];
  config: RuleConfig;
  error_message: string;
  applies_on: ValidationTrigger[];
  stage_triggers: StageTriggers | null;
  priority: number;
  is_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface FieldValidationError {
  field: string;
  rule_id: string;
  rule_name: string;
  rule_type: ValidationRuleType;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
  passed_rules: string[];  // Rule IDs that passed
  skipped_rules: string[]; // Rule IDs that were skipped (conditions not met)
}

export interface SingleRuleResult {
  rule_id: string;
  result: 'pass' | 'fail' | 'skip';
  error?: FieldValidationError;
}

// ============================================================================
// Validation Context
// ============================================================================

export interface ValidationContext {
  trigger: ValidationTrigger;
  from_stage?: string | null;
  to_stage?: string | null;
  user_id?: string;
  profile_id?: string;
  pending_updates?: Record<string, unknown>;
}

// ============================================================================
// Validation Run Log
// ============================================================================

export interface ValidationRuleRun {
  id: string;
  org_id: string;
  rule_id: string | null;
  record_id: string;
  trigger: ValidationTrigger;
  result: 'pass' | 'fail' | 'skip';
  field_value: unknown;
  errors: FieldValidationError[];
  context: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Format Patterns
// ============================================================================

export const FORMAT_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
  url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  numeric: /^-?\d*\.?\d+$/,
} as const;

// ============================================================================
// Helpers
// ============================================================================

export function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export function normalizeConditions(
  conditions: ConditionGroup | Condition[] | undefined
): ConditionGroup {
  if (!conditions) {
    return { logic: 'AND', conditions: [] };
  }
  if (Array.isArray(conditions)) {
    return { logic: 'AND', conditions };
  }
  return conditions;
}
