/**
 * Shared Rule Operator Vocabulary
 *
 * Single source of truth for the condition-operator vocabulary used by both
 * the CRM approval rules engine (apps/crm/src/lib/approvals) and the
 * questionnaire/eligibility logic. Both import from here so there is exactly
 * ONE operator union and ONE evaluation implementation.
 *
 * The operator list MUST stay in sync with the Zod enum in
 * apps/crm/src/app/api/approvals/rules/route.ts.
 */

// ============================================================================
// Operator Vocabulary
// ============================================================================

/**
 * Comparison operators supported by rule conditions.
 *
 * Mirrors the original ApprovalConditionOperator union that previously lived in
 * apps/crm/src/lib/approvals/types.ts.
 */
export type RuleConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty';

/**
 * Runtime-iterable list of every supported operator (same order as the type
 * union). Useful for building selects, Zod enums, or validation.
 */
export const RULE_CONDITION_OPERATORS: readonly RuleConditionOperator[] = [
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'contains',
  'in',
  'not_in',
  'is_empty',
  'is_not_empty',
] as const;

// ============================================================================
// Condition Shapes
// ============================================================================

/**
 * A single field/operator/value condition.
 *
 * Mirrors the original ApprovalCondition interface from
 * apps/crm/src/lib/approvals/types.ts.
 */
export interface RuleCondition {
  field: string;
  operator: RuleConditionOperator;
  value: string | number | boolean | string[] | null;
}

/**
 * A group of conditions combined with AND/OR logic.
 *
 * Mirrors the original ApprovalRuleConditions interface from
 * apps/crm/src/lib/approvals/types.ts.
 */
export interface RuleConditionGroup {
  logic: 'AND' | 'OR';
  conditions: RuleCondition[];
}

// ============================================================================
// Pure Evaluation
// ============================================================================

/**
 * Pure operator evaluation. Compares a left-hand value against a right-hand
 * value using the given operator and returns a boolean.
 *
 * This is the single implementation extracted from
 * apps/crm/src/lib/approvals/rules.ts so that approval rules and questionnaire
 * logic share identical semantics. No side effects, no I/O.
 *
 * @param operator - the comparison operator
 * @param left     - the field value being tested (recordData[field])
 * @param right    - the configured comparison value (condition.value)
 */
export function evaluateCondition(
  operator: RuleConditionOperator,
  left: unknown,
  right: unknown
): boolean {
  switch (operator) {
    case 'eq':
      return left === right;

    case 'neq':
      return left !== right;

    case 'gt':
      if (typeof left === 'number' && typeof right === 'number') {
        return left > right;
      }
      return Number(left) > Number(right);

    case 'gte':
      if (typeof left === 'number' && typeof right === 'number') {
        return left >= right;
      }
      return Number(left) >= Number(right);

    case 'lt':
      if (typeof left === 'number' && typeof right === 'number') {
        return left < right;
      }
      return Number(left) < Number(right);

    case 'lte':
      if (typeof left === 'number' && typeof right === 'number') {
        return left <= right;
      }
      return Number(left) <= Number(right);

    case 'contains':
      if (typeof left === 'string' && typeof right === 'string') {
        return left.toLowerCase().includes(right.toLowerCase());
      }
      return false;

    case 'in':
      if (Array.isArray(right)) {
        return right.includes(left as string);
      }
      return false;

    case 'not_in':
      if (Array.isArray(right)) {
        return !right.includes(left as string);
      }
      return true;

    case 'is_empty':
      return left === null || left === undefined || left === '';

    case 'is_not_empty':
      return left !== null && left !== undefined && left !== '';

    default:
      return false;
  }
}

/**
 * Evaluate a single RuleCondition against a record map.
 *
 * Convenience wrapper around {@link evaluateCondition} that resolves the field
 * value from the record before comparing. Mirrors the per-condition behavior of
 * the original approvals rules engine.
 */
export function evaluateRuleCondition(
  condition: RuleCondition,
  recordData: Record<string, unknown>
): boolean {
  return evaluateCondition(
    condition.operator,
    recordData[condition.field],
    condition.value
  );
}

/**
 * Evaluate a group of conditions with AND/OR logic against a record map.
 *
 * Mirrors the original evaluateConditions helper in approvals/rules.ts: an
 * empty/absent condition list always matches; logic defaults to 'AND'.
 */
export function evaluateRuleConditionGroup(
  group: RuleConditionGroup,
  recordData: Record<string, unknown>
): boolean {
  if (!group.conditions || group.conditions.length === 0) {
    return true;
  }

  const logic = group.logic || 'AND';

  if (logic === 'AND') {
    return group.conditions.every((c) => evaluateRuleCondition(c, recordData));
  }

  return group.conditions.some((c) => evaluateRuleCondition(c, recordData));
}
