/**
 * CRM Automation Pack - Condition Evaluator
 * Evaluates condition DSL against records
 */

import type { CrmRecord } from '../crm/types';
import type {
  Condition,
  ConditionGroup,
  ConditionOperator,
} from './types';

// ============================================================================
// Field Resolution
// ============================================================================

const SYSTEM_FIELDS = ['title', 'status', 'stage', 'email', 'phone', 'owner_id', 'created_by', 'created_at', 'updated_at'];

/**
 * Resolves a field value from a record
 * Handles both system fields and custom fields in data/system JSONB
 */
export function resolveFieldValue(record: CrmRecord, fieldKey: string): unknown {
  // Check system-level indexed fields first
  if (SYSTEM_FIELDS.includes(fieldKey)) {
    return (record as unknown as Record<string, unknown>)[fieldKey];
  }

  // Check system JSONB (for linked_member_id, etc.)
  if (record.system && fieldKey in record.system) {
    return record.system[fieldKey];
  }

  // Check custom data JSONB
  if (record.data && fieldKey in record.data) {
    return record.data[fieldKey];
  }

  return undefined;
}

/**
 * Resolves a nested field path (e.g., 'data.first_name' or 'system.linked_member_id')
 */
export function resolveFieldPath(record: CrmRecord, path: string): unknown {
  const parts = path.split('.');
  
  if (parts.length === 1) {
    return resolveFieldValue(record, path);
  }

  // Navigate nested path
  let current: unknown = record;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

// ============================================================================
// Operator Implementations
// ============================================================================

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.toLowerCase().trim();
  }
  return value;
}

function evaluateOperator(
  operator: ConditionOperator,
  fieldValue: unknown,
  conditionValue: unknown,
  previousFieldValue?: unknown
): boolean {
  const normalizedFieldValue = normalizeValue(fieldValue);
  const normalizedConditionValue = normalizeValue(conditionValue);

  switch (operator) {
    case 'eq':
      return normalizedFieldValue === normalizedConditionValue;

    case 'ne':
      return normalizedFieldValue !== normalizedConditionValue;

    case 'contains':
      if (typeof normalizedFieldValue !== 'string') return false;
      if (typeof normalizedConditionValue !== 'string') return false;
      return normalizedFieldValue.includes(normalizedConditionValue);

    case 'not_contains':
      if (typeof normalizedFieldValue !== 'string') return true;
      if (typeof normalizedConditionValue !== 'string') return true;
      return !normalizedFieldValue.includes(normalizedConditionValue);

    case 'starts_with':
      if (typeof normalizedFieldValue !== 'string') return false;
      if (typeof normalizedConditionValue !== 'string') return false;
      return normalizedFieldValue.startsWith(normalizedConditionValue);

    case 'ends_with':
      if (typeof normalizedFieldValue !== 'string') return false;
      if (typeof normalizedConditionValue !== 'string') return false;
      return normalizedFieldValue.endsWith(normalizedConditionValue);

    case 'in':
      if (!Array.isArray(conditionValue)) return false;
      return conditionValue.some(v => normalizeValue(v) === normalizedFieldValue);

    case 'not_in':
      if (!Array.isArray(conditionValue)) return true;
      return !conditionValue.some(v => normalizeValue(v) === normalizedFieldValue);

    case 'gt':
      if (typeof fieldValue !== 'number' || typeof conditionValue !== 'number') return false;
      return fieldValue > conditionValue;

    case 'gte':
      if (typeof fieldValue !== 'number' || typeof conditionValue !== 'number') return false;
      return fieldValue >= conditionValue;

    case 'lt':
      if (typeof fieldValue !== 'number' || typeof conditionValue !== 'number') return false;
      return fieldValue < conditionValue;

    case 'lte':
      if (typeof fieldValue !== 'number' || typeof conditionValue !== 'number') return false;
      return fieldValue <= conditionValue;

    case 'is_empty':
      return fieldValue === null || 
             fieldValue === undefined || 
             fieldValue === '' ||
             (Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'not_empty':
      return fieldValue !== null && 
             fieldValue !== undefined && 
             fieldValue !== '' &&
             !(Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'changed':
      if (previousFieldValue === undefined) return false;
      return normalizeValue(previousFieldValue) !== normalizedFieldValue;

    case 'changed_to':
      if (previousFieldValue === undefined) return false;
      return normalizeValue(previousFieldValue) !== normalizedFieldValue &&
             normalizedFieldValue === normalizedConditionValue;

    case 'changed_from':
      if (previousFieldValue === undefined) return false;
      return normalizeValue(previousFieldValue) === normalizedConditionValue &&
             normalizedFieldValue !== normalizedConditionValue;

    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

// ============================================================================
// Condition Evaluation
// ============================================================================

/**
 * Evaluates a single condition against a record
 */
export function evaluateCondition(
  condition: Condition,
  record: CrmRecord,
  previousRecord?: CrmRecord
): boolean {
  const fieldValue = resolveFieldPath(record, condition.field);
  const previousFieldValue = previousRecord 
    ? resolveFieldPath(previousRecord, condition.field) 
    : undefined;

  return evaluateOperator(
    condition.operator,
    fieldValue,
    condition.value,
    previousFieldValue
  );
}

/**
 * Type guard to check if something is a ConditionGroup
 */
function isConditionGroup(item: Condition | ConditionGroup): item is ConditionGroup {
  return 'logic' in item && 'conditions' in item;
}

/**
 * Evaluates a condition group with AND/OR logic
 */
export function evaluateConditionGroup(
  group: ConditionGroup,
  record: CrmRecord,
  previousRecord?: CrmRecord
): boolean {
  if (!group.conditions || group.conditions.length === 0) {
    return true; // Empty conditions = always match
  }

  const results = group.conditions.map(item => {
    if (isConditionGroup(item)) {
      return evaluateConditionGroup(item, record, previousRecord);
    }
    return evaluateCondition(item, record, previousRecord);
  });

  if (group.logic === 'AND') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

/**
 * Evaluates conditions (can be array or group)
 */
export function evaluateConditions(
  conditions: ConditionGroup | Condition[],
  record: CrmRecord,
  previousRecord?: CrmRecord
): boolean {
  // Handle legacy array format
  if (Array.isArray(conditions)) {
    if (conditions.length === 0) {
      return true;
    }
    // Treat array as AND group
    return conditions.every(condition => 
      evaluateCondition(condition, record, previousRecord)
    );
  }

  // Handle condition group format
  return evaluateConditionGroup(conditions, record, previousRecord);
}

// ============================================================================
// Trigger Matching
// ============================================================================

/**
 * Checks if an update trigger should fire based on trigger_config
 */
export function shouldTriggerOnUpdate(
  triggerConfig: Record<string, unknown>,
  record: CrmRecord,
  previousRecord?: CrmRecord
): boolean {
  if (!previousRecord) {
    return false; // No previous record means this is a create, not update
  }

  const watchFields = triggerConfig.watchFields as string[] | undefined;
  
  // If no specific fields to watch, trigger on any update
  if (!watchFields || watchFields.length === 0) {
    return true;
  }

  // Check if any watched field changed
  for (const field of watchFields) {
    const currentValue = resolveFieldPath(record, field);
    const previousValue = resolveFieldPath(previousRecord, field);
    
    if (normalizeValue(currentValue) !== normalizeValue(previousValue)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Field Change Detection
// ============================================================================

/**
 * Returns an object with all changed fields
 */
export function getChangedFields(
  record: CrmRecord,
  previousRecord?: CrmRecord
): Record<string, { from: unknown; to: unknown }> {
  if (!previousRecord) {
    return {};
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};

  // Check system fields
  for (const field of SYSTEM_FIELDS) {
    const currentValue = resolveFieldValue(record, field);
    const previousValue = resolveFieldValue(previousRecord, field);
    
    if (normalizeValue(currentValue) !== normalizeValue(previousValue)) {
      changes[field] = { from: previousValue, to: currentValue };
    }
  }

  // Check custom data fields
  const allDataKeys = new Set([
    ...Object.keys(record.data || {}),
    ...Object.keys(previousRecord.data || {}),
  ]);

  for (const key of allDataKeys) {
    const currentValue = record.data?.[key];
    const previousValue = previousRecord.data?.[key];
    
    if (normalizeValue(currentValue) !== normalizeValue(previousValue)) {
      changes[key] = { from: previousValue, to: currentValue };
    }
  }

  return changes;
}
