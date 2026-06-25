/**
 * Shared rule primitives: the condition-operator vocabulary, condition shapes,
 * and the single pure evaluation implementation. Imported by both the CRM
 * approval rules engine and questionnaire/eligibility logic.
 */
export {
  RULE_CONDITION_OPERATORS,
  evaluateCondition,
  evaluateRuleCondition,
  evaluateRuleConditionGroup,
} from './operators';
export type {
  RuleConditionOperator,
  RuleCondition,
  RuleConditionGroup,
} from './operators';
