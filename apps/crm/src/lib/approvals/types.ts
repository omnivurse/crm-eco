/**
 * CRM Approvals - Type Definitions
 * Multi-step approval processes with role-based routing
 */

import type { ConditionGroup, Condition } from '../automation/types';

// ============================================================================
// Approval Process Definition
// ============================================================================

export type ApprovalTriggerType = 'stage_transition' | 'field_change' | 'record_create' | 'manual';

export interface ApprovalTriggerConfig {
  stage_from?: string;
  stage_to?: string;
  field?: string;
  condition?: {
    operator: string;
    value: unknown;
  };
}

export type ApprovalStepType = 'role' | 'user' | 'manager' | 'record_owner';

export interface ApprovalStep {
  type: ApprovalStepType;
  value: string;           // Role name or user ID
  require_comment?: boolean;
  can_delegate?: boolean;
  timeout_hours?: number;  // Auto-escalate after X hours
}

export interface CrmApprovalProcess {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  trigger_type: ApprovalTriggerType;
  trigger_config: ApprovalTriggerConfig;
  conditions: ConditionGroup | Condition[];
  steps: ApprovalStep[];
  on_approve_actions: unknown[];
  on_reject_actions: unknown[];
  auto_approve_after_hours: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Approval Instance
// ============================================================================

export type ApprovalStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'changes_requested' 
  | 'cancelled' 
  | 'expired';

export interface ApprovalContext {
  action_type: string;
  blueprint_id?: string;
  stage_from?: string | null;
  stage_to?: string;
  field_changes?: Record<string, { old: unknown; new: unknown }>;
  [key: string]: unknown;
}

export interface CrmApproval {
  id: string;
  org_id: string;
  process_id: string;
  record_id: string;
  status: ApprovalStatus;
  current_step: number;
  context: ApprovalContext;
  requested_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Approval Actions
// ============================================================================

export type ApprovalActionType = 
  | 'approve' 
  | 'reject' 
  | 'request_changes' 
  | 'comment' 
  | 'delegate' 
  | 'reassign';

export interface CrmApprovalAction {
  id: string;
  org_id: string;
  approval_id: string;
  step_index: number;
  actor_id: string | null;
  action: ApprovalActionType;
  comment: string | null;
  delegate_to: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ApprovalActionRequest {
  approvalId: string;
  action: 'approve' | 'reject' | 'request_changes';
  comment?: string;
}

export interface ApprovalActionResult {
  success: boolean;
  approvalId: string;
  newStatus: ApprovalStatus;
  actionExecuted?: boolean;
  error?: string;
}

export interface PendingApproval {
  id: string;
  process_name: string;
  record_id: string;
  record_title: string;
  module_name: string;
  context: ApprovalContext;
  current_step: number;
  total_steps: number;
  requested_by_name: string | null;
  created_at: string;
}

// ============================================================================
// Approver Resolution
// ============================================================================

export interface ResolvedApprover {
  profile_id: string;
  full_name: string;
  email: string;
}

export function isUserApprover(
  step: ApprovalStep,
  userProfileId: string,
  userRole: string | null,
  recordOwnerId: string | null
): boolean {
  switch (step.type) {
    case 'user':
      return step.value === userProfileId;
    case 'role':
      return step.value === userRole;
    case 'manager':
      // Would need to implement manager lookup
      return false;
    case 'record_owner':
      return recordOwnerId === userProfileId;
    default:
      return false;
  }
}

// ============================================================================
// W4: Approval Rules
// ============================================================================

export type ApprovalRuleTriggerType = 
  | 'field_change'
  | 'stage_transition'
  | 'record_delete'
  | 'record_create'
  | 'field_threshold';

export type ApprovalConditionOperator = 
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

export interface ApprovalCondition {
  field: string;
  operator: ApprovalConditionOperator;
  value: string | number | boolean | string[] | null;
}

export interface ApprovalRuleConditions {
  logic: 'AND' | 'OR';
  conditions: ApprovalCondition[];
}

export interface ApprovalRuleTriggerConfig {
  field?: string;
  stage_from?: string;
  stage_to?: string;
  threshold?: number;
}

export interface CrmApprovalRule {
  id: string;
  org_id: string;
  module_id: string;
  process_id: string;
  name: string;
  description: string | null;
  trigger_type: ApprovalRuleTriggerType;
  trigger_config: ApprovalRuleTriggerConfig;
  conditions: ApprovalRuleConditions;
  priority: number;
  is_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// W4: Action Payload (for blocked actions)
// ============================================================================

export type ApprovalActionPayloadType = 
  | 'update' 
  | 'delete' 
  | 'stage_change'
  | 'field_update';

export interface ApprovalActionPayload {
  type: ApprovalActionPayloadType;
  record_id: string;
  module_id: string;
  data?: Record<string, unknown>;
  stage_from?: string | null;
  stage_to?: string;
  field_changes?: Record<string, { old: unknown; new: unknown }>;
}

// ============================================================================
// W4: Extended Approval (with new fields)
// ============================================================================

export interface CrmApprovalExtended extends CrmApproval {
  action_payload: ApprovalActionPayload | null;
  applied_at: string | null;
  idempotency_key: string | null;
  rule_id: string | null;
  entity_snapshot: Record<string, unknown> | null;
}

// ============================================================================
// W4: Approval Decision
// ============================================================================

export type ApprovalDecisionType = 
  | 'approve' 
  | 'reject' 
  | 'request_changes' 
  | 'delegate' 
  | 'escalate';

export interface CrmApprovalDecision {
  id: string;
  org_id: string;
  approval_id: string;
  step_index: number;
  decision: ApprovalDecisionType;
  decided_by: string;
  comment: string | null;
  delegated_to: string | null;
  decision_context: Record<string, unknown>;
  decided_at: string;
  time_to_decision_seconds: number | null;
  created_at: string;
}

// ============================================================================
// W4: Inbox Types
// ============================================================================

export interface ApprovalInboxItem {
  id: string;
  process_id: string;
  process_name: string;
  record_id: string;
  record_title: string;
  module_key: string;
  module_name: string;
  status: ApprovalStatus;
  current_step: number;
  total_steps: number;
  context: ApprovalContext;
  requested_by: string | null;
  requested_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalInboxFilters {
  status?: ApprovalStatus | 'all';
  entity_type?: string;
  assigned_to_me?: boolean;
  requested_by_me?: boolean;
  date_from?: string;
  date_to?: string;
}

// ============================================================================
// W4: Approval Detail
// ============================================================================

export interface ApprovalDetailData {
  id: string;
  org_id: string;
  process_id: string;
  process_name: string;
  process_description: string | null;
  process_steps: ApprovalStep[];
  record_id: string;
  record_title: string;
  record_data: Record<string, unknown>;
  module_id: string;
  module_key: string;
  module_name: string;
  status: ApprovalStatus;
  current_step: number;
  context: ApprovalContext;
  action_payload: ApprovalActionPayload | null;
  entity_snapshot: Record<string, unknown> | null;
  requested_by: string | null;
  requested_by_name: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  applied_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// W4: Create Approval Request Types
// ============================================================================

export interface CreateApprovalRequestInput {
  orgId: string;
  moduleId: string;
  recordId: string;
  processId: string;
  ruleId?: string;
  triggerType: ApprovalRuleTriggerType;
  actionPayload: ApprovalActionPayload;
  context: ApprovalContext;
  requestedBy: string;
  entitySnapshot?: Record<string, unknown>;
}

export interface CreateApprovalRequestResult {
  success: boolean;
  approvalId?: string;
  error?: string;
}

// ============================================================================
// W4: Apply Approved Action Types
// ============================================================================

export interface ApplyApprovedActionInput {
  approvalId: string;
  profileId: string;
  userId: string;
}

export interface ApplyApprovedActionResult {
  success: boolean;
  applied: boolean;
  error?: string;
}

// ============================================================================
// W4: Rule Match Result
// ============================================================================

export interface RuleMatchResult {
  ruleId: string;
  processId: string;
  ruleName: string;
}
