/**
 * CRM Blueprints - Type Definitions
 * Stage gating, transitions, and required field enforcement
 */

import type { WorkflowAction } from '../automation/types';

// ============================================================================
// Stage Definition
// ============================================================================

export interface BlueprintStage {
  key: string;
  label: string;
  order: number;
  color?: string;
  description?: string;
}

// ============================================================================
// Transition Definition
// ============================================================================

export interface BlueprintTransition {
  from: string;         // Stage key (or '*' for any)
  to: string;           // Stage key
  required_fields: string[];  // Field keys that must have values
  actions: WorkflowAction[];  // Actions to execute on transition
  requires_approval?: boolean;
  approval_process_id?: string;
  require_reason?: boolean;
  allowed_roles?: string[];   // CRM roles that can make this transition
}

// ============================================================================
// Blueprint Definition
// ============================================================================

export interface CrmBlueprint {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  is_default: boolean;
  stages: BlueprintStage[];
  transitions: BlueprintTransition[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Stage History
// ============================================================================

export interface CrmStageHistory {
  id: string;
  org_id: string;
  record_id: string;
  blueprint_id: string | null;
  from_stage: string | null;
  to_stage: string;
  reason: string | null;
  transition_data: Record<string, unknown>;
  changed_by: string | null;
  approval_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Transition Request/Response
// ============================================================================

export interface TransitionRequest {
  recordId: string;
  toStage: string;
  reason?: string;
  payload?: Record<string, unknown>;  // Field values to update
}

export interface TransitionResult {
  success: boolean;
  requiresApproval?: boolean;
  approvalId?: string;
  error?: string;
  missingFields?: string[];
  invalidTransition?: boolean;
  record?: {
    id: string;
    stage: string;
  };
}

// ============================================================================
// Validation Types
// ============================================================================

export interface TransitionValidation {
  valid: boolean;
  allowed: boolean;
  missingFields: string[];
  transition: BlueprintTransition | null;
  requiresApproval: boolean;
  requiresReason: boolean;
  error?: string;
}

export interface AvailableTransition {
  to: string;
  toLabel: string;
  toColor?: string;
  required_fields: string[];
  requires_approval: boolean;
  require_reason: boolean;
}

// ============================================================================
// Record with Stage
// ============================================================================

export interface RecordWithStage {
  id: string;
  org_id: string;
  module_id: string;
  stage: string | null;
  data: Record<string, unknown>;
  owner_id: string | null;
  [key: string]: unknown;
}

// ============================================================================
// Field Validation
// ============================================================================

export interface FieldRequirement {
  key: string;
  label: string;
  type: string;
  isFilled: boolean;
  value?: unknown;
}

export function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}
