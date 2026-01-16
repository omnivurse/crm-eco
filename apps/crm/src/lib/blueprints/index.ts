/**
 * CRM Blueprints Library
 * Stage gating, transitions, and required field enforcement
 */

// Types
export * from './types';

// Validator
export {
  findTransition,
  getAvailableTransitions,
  getMissingFields,
  getFieldRequirements,
  validateTransition,
  getStage,
  getOrderedStages,
  isValidStage,
} from './validator';

// Engine
export {
  getModuleBlueprint,
  getBlueprintById,
  executeTransition,
  executeApprovedTransition,
} from './engine';
