/**
 * CRM Validation Rules Library
 * Configurable field-level and cross-field validation
 */

// Types
export * from './types';

// Engine
export {
  getValidationRules,
  getStageValidationRules,
  evaluateRule,
  validateRecord,
  validateStageTransition,
  logValidationRun,
} from './engine';
