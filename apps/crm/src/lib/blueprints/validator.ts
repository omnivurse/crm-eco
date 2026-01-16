/**
 * CRM Blueprints - Validation Engine
 * Validates stage transitions against blueprint rules
 */

import type {
  CrmBlueprint,
  BlueprintTransition,
  RecordWithStage,
  TransitionValidation,
  AvailableTransition,
  FieldRequirement,
} from './types';
import { isFieldFilled } from './types';

// ============================================================================
// Find Transition
// ============================================================================

/**
 * Find a valid transition from current stage to target stage
 */
export function findTransition(
  blueprint: CrmBlueprint,
  fromStage: string | null,
  toStage: string
): BlueprintTransition | null {
  // Look for exact match first
  let transition = blueprint.transitions.find(
    t => t.from === fromStage && t.to === toStage
  );
  
  // Try wildcard from
  if (!transition) {
    transition = blueprint.transitions.find(
      t => t.from === '*' && t.to === toStage
    );
  }
  
  return transition || null;
}

// ============================================================================
// Get Available Transitions
// ============================================================================

/**
 * Get all valid transitions from the current stage
 */
export function getAvailableTransitions(
  blueprint: CrmBlueprint,
  currentStage: string | null,
  userRole?: string
): AvailableTransition[] {
  const available: AvailableTransition[] = [];
  
  for (const transition of blueprint.transitions) {
    // Check if transition is from current stage or wildcard
    if (transition.from !== currentStage && transition.from !== '*') {
      continue;
    }
    
    // Check role restriction
    if (transition.allowed_roles && transition.allowed_roles.length > 0) {
      if (!userRole || !transition.allowed_roles.includes(userRole)) {
        continue;
      }
    }
    
    // Find stage info
    const toStage = blueprint.stages.find(s => s.key === transition.to);
    if (!toStage) continue;
    
    available.push({
      to: transition.to,
      toLabel: toStage.label,
      toColor: toStage.color,
      required_fields: transition.required_fields || [],
      requires_approval: transition.requires_approval || false,
      require_reason: transition.require_reason || false,
    });
  }
  
  return available;
}

// ============================================================================
// Validate Field Requirements
// ============================================================================

/**
 * Get list of missing required fields for a transition
 */
export function getMissingFields(
  record: RecordWithStage,
  requiredFields: string[],
  pendingUpdates?: Record<string, unknown>
): string[] {
  const missing: string[] = [];
  
  // Merge record data with pending updates
  const effectiveData = {
    ...record,
    ...record.data,
    ...pendingUpdates,
  };
  
  for (const fieldKey of requiredFields) {
    const value = effectiveData[fieldKey];
    if (!isFieldFilled(value)) {
      missing.push(fieldKey);
    }
  }
  
  return missing;
}

/**
 * Get detailed field requirements with fill status
 */
export function getFieldRequirements(
  record: RecordWithStage,
  requiredFields: string[],
  fieldDefinitions?: Array<{ key: string; label: string; type: string }>
): FieldRequirement[] {
  const requirements: FieldRequirement[] = [];
  
  const effectiveData = {
    ...record,
    ...record.data,
  };
  
  for (const fieldKey of requiredFields) {
    const value = effectiveData[fieldKey];
    const fieldDef = fieldDefinitions?.find(f => f.key === fieldKey);
    
    requirements.push({
      key: fieldKey,
      label: fieldDef?.label || fieldKey,
      type: fieldDef?.type || 'text',
      isFilled: isFieldFilled(value),
      value,
    });
  }
  
  return requirements;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a stage transition
 */
export function validateTransition(
  blueprint: CrmBlueprint,
  record: RecordWithStage,
  toStage: string,
  options?: {
    userRole?: string;
    pendingUpdates?: Record<string, unknown>;
    reason?: string;
  }
): TransitionValidation {
  const currentStage = record.stage;
  
  // Find the transition
  const transition = findTransition(blueprint, currentStage, toStage);
  
  if (!transition) {
    return {
      valid: false,
      allowed: false,
      missingFields: [],
      transition: null,
      requiresApproval: false,
      requiresReason: false,
      error: `Transition from "${currentStage || 'none'}" to "${toStage}" is not allowed`,
    };
  }
  
  // Check role restriction
  if (transition.allowed_roles && transition.allowed_roles.length > 0) {
    if (!options?.userRole || !transition.allowed_roles.includes(options.userRole)) {
      return {
        valid: false,
        allowed: false,
        missingFields: [],
        transition,
        requiresApproval: false,
        requiresReason: false,
        error: 'You do not have permission to make this transition',
      };
    }
  }
  
  // Check required fields
  const missingFields = getMissingFields(
    record,
    transition.required_fields || [],
    options?.pendingUpdates
  );
  
  // Check if reason is required
  const requiresReason = transition.require_reason || false;
  if (requiresReason && !options?.reason) {
    return {
      valid: false,
      allowed: true,
      missingFields,
      transition,
      requiresApproval: transition.requires_approval || false,
      requiresReason: true,
      error: 'A reason is required for this transition',
    };
  }
  
  // If there are missing fields, transition is not valid
  if (missingFields.length > 0) {
    return {
      valid: false,
      allowed: true,
      missingFields,
      transition,
      requiresApproval: transition.requires_approval || false,
      requiresReason,
      error: `Required fields missing: ${missingFields.join(', ')}`,
    };
  }
  
  return {
    valid: true,
    allowed: true,
    missingFields: [],
    transition,
    requiresApproval: transition.requires_approval || false,
    requiresReason,
  };
}

// ============================================================================
// Stage Helpers
// ============================================================================

/**
 * Get stage by key
 */
export function getStage(
  blueprint: CrmBlueprint,
  stageKey: string | null
): { key: string; label: string; color?: string; order: number } | null {
  if (!stageKey) return null;
  return blueprint.stages.find(s => s.key === stageKey) || null;
}

/**
 * Get ordered stages for display
 */
export function getOrderedStages(blueprint: CrmBlueprint) {
  return [...blueprint.stages].sort((a, b) => a.order - b.order);
}

/**
 * Check if a stage exists in the blueprint
 */
export function isValidStage(blueprint: CrmBlueprint, stageKey: string): boolean {
  return blueprint.stages.some(s => s.key === stageKey);
}
