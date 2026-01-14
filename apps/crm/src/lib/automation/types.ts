/**
 * CRM Automation Pack - Type Definitions
 */

import type { CrmRecord, CrmTask, CrmNote } from '../crm/types';

// ============================================================================
// Condition Types
// ============================================================================

export type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_empty'
  | 'not_empty'
  | 'changed'
  | 'changed_to'
  | 'changed_from';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
  previousValue?: unknown; // For 'changed' operators
}

export interface ConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (Condition | ConditionGroup)[];
}

// ============================================================================
// Action Types
// ============================================================================

export type ActionType =
  | 'update_fields'
  | 'assign_owner'
  | 'create_task'
  | 'create_activity'
  | 'add_note'
  | 'notify'
  | 'move_stage'
  | 'start_cadence'
  | 'stop_cadence'
  | 'create_enrollment_draft'
  | 'send_email'
  | 'send_sms'
  | 'delay_wait'
  | 'post_webhook';

export interface UpdateFieldsConfig {
  fields: Record<string, unknown>;
}

export interface AssignOwnerConfig {
  ruleId?: string;
  strategy?: 'round_robin' | 'territory' | 'least_loaded' | 'fixed';
  userId?: string; // For fixed strategy
}

export interface CreateTaskConfig {
  title: string;
  description?: string;
  dueInDays?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: 'owner' | 'creator' | string; // 'owner', 'creator', or specific user ID
}

export interface AddNoteConfig {
  body: string;
  isPinned?: boolean;
}

export interface NotifyConfig {
  recipients: ('owner' | 'creator' | string)[]; // 'owner', 'creator', or specific user IDs
  title: string;
  body?: string;
  href?: string;
}

export interface MoveStageConfig {
  stage: string;
}

export interface StartCadenceConfig {
  cadenceId: string;
}

export interface StopCadenceConfig {
  cadenceId?: string; // If not specified, stop all cadences
}

export interface CreateEnrollmentDraftConfig {
  explicit: boolean; // Must be true to execute
  planId?: string;
  effectiveDate?: string;
  additionalData?: Record<string, unknown>;
}

export interface SendEmailConfig {
  templateId?: string;
  subject?: string;
  body?: string;
  to?: string; // Override recipient, otherwise uses record email
}

export interface SendSmsConfig {
  templateId?: string;
  body?: string;
  to?: string; // Override recipient, otherwise uses record phone
}

export interface DelayWaitConfig {
  delaySeconds?: number;
  delayMinutes?: number;
  delayHours?: number;
  delayDays?: number;
  delayType?: 'fixed' | 'relative';
  delayField?: string; // For relative delays based on record date field
}

export interface PostWebhookConfig {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  includeRecord?: boolean;
  bodyTemplate?: string; // JSON template with {{field}} placeholders
  retryOnFailure?: boolean;
}

export interface CreateActivityConfig {
  activityType: 'task' | 'call' | 'meeting' | 'email';
  title: string;
  description?: string;
  dueInDays?: number;
  dueInHours?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: 'owner' | 'creator' | string;
  // Call-specific
  callType?: 'outbound' | 'inbound';
  // Meeting-specific
  meetingType?: 'in_person' | 'video' | 'phone';
  meetingLocation?: string;
  attendees?: string[];
}

export interface WorkflowAction {
  id: string;
  type: ActionType;
  config:
    | UpdateFieldsConfig
    | AssignOwnerConfig
    | CreateTaskConfig
    | CreateActivityConfig
    | AddNoteConfig
    | NotifyConfig
    | MoveStageConfig
    | StartCadenceConfig
    | StopCadenceConfig
    | CreateEnrollmentDraftConfig
    | SendEmailConfig
    | SendSmsConfig
    | DelayWaitConfig
    | PostWebhookConfig;
  order: number;
}

// ============================================================================
// Workflow Types
// ============================================================================

export type TriggerType = 'on_create' | 'on_update' | 'on_stage_change' | 'scheduled' | 'webform' | 'inbound_webhook';

export interface ScheduledTriggerConfig {
  cron?: string;
  timezone?: string;
  daysAfterField?: string; // Field to check for date
  daysAfterValue?: number; // Number of days after that field
}

export interface UpdateTriggerConfig {
  watchFields?: string[]; // Only trigger when these fields change
}

export interface WebformTriggerConfig {
  webformId?: string; // Specific webform or all
}

export interface StageChangeTriggerConfig {
  fromStages?: string[]; // Trigger when changing from these stages (empty = any)
  toStages?: string[]; // Trigger when changing to these stages (empty = any)
  dealStageIds?: string[]; // Specific deal stage IDs to watch
}

export interface InboundWebhookTriggerConfig {
  webhookPath?: string; // Custom path suffix
  payloadMapping?: Record<string, string>; // Map webhook payload fields to record fields
  validateSignature?: boolean;
}

export type TriggerConfig = 
  | ScheduledTriggerConfig 
  | UpdateTriggerConfig 
  | WebformTriggerConfig 
  | StageChangeTriggerConfig
  | InboundWebhookTriggerConfig
  | Record<string, unknown>;

export interface CrmWorkflow {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  conditions: ConditionGroup | Condition[];
  actions: WorkflowAction[];
  priority: number;
  webhook_secret: string | null; // For inbound webhook validation
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Workflow Step Types (Multi-step workflows with delays)
// ============================================================================

export type DelayType = 'immediate' | 'fixed' | 'relative';

export interface CrmWorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  name: string | null;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  delay_seconds: number;
  delay_type: DelayType;
  delay_field: string | null;
  conditions: ConditionGroup | Condition[];
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Workflow Run Log Types (Step-by-step execution logs)
// ============================================================================

export type RunLogStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'waiting';

export interface CrmWorkflowRunLog {
  id: string;
  run_id: string;
  step_id: string | null;
  step_order: number;
  action_type: string;
  status: RunLogStatus;
  started_at: string | null;
  completed_at: string | null;
  scheduled_for: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  retry_count: number;
  created_at: string;
}

// ============================================================================
// Macro Types (One-click action bundles)
// ============================================================================

export type CrmRole = 'crm_admin' | 'crm_manager' | 'crm_agent' | 'crm_viewer';

export interface CrmMacro {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  actions: WorkflowAction[];
  is_enabled: boolean;
  display_order: number;
  allowed_roles: CrmRole[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmMacroRun {
  id: string;
  org_id: string;
  macro_id: string;
  record_id: string;
  status: 'running' | 'success' | 'failed' | 'partial';
  executed_by: string | null;
  actions_executed: ActionResult[];
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================================================
// Scheduler Job Types
// ============================================================================

export type SchedulerJobType = 'workflow_step' | 'scheduled_workflow' | 'retry' | 'cadence_step' | 'sla_escalation';
export type SchedulerJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface CrmSchedulerJob {
  id: string;
  org_id: string;
  job_type: SchedulerJobType;
  entity_type: string;
  entity_id: string;
  record_id: string | null;
  run_at: string;
  status: SchedulerJobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
  completed_at: string | null;
}

// ============================================================================
// Assignment Rule Types
// ============================================================================

export type AssignmentStrategy = 'round_robin' | 'territory' | 'least_loaded' | 'fixed';

export interface RoundRobinConfig {
  userIds: string[];
  currentIndex: number;
}

export interface TerritoryConfig {
  field: string; // Field to match (e.g., 'state', 'zip')
  territories: {
    values: string[];
    userId: string;
  }[];
  fallbackUserId?: string;
}

export interface LeastLoadedConfig {
  userIds: string[];
  countField?: string; // Field to count, defaults to open records
}

export interface FixedConfig {
  userId: string;
}

export interface CrmAssignmentRule {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  is_enabled: boolean;
  strategy: AssignmentStrategy;
  config: RoundRobinConfig | TerritoryConfig | LeastLoadedConfig | FixedConfig;
  conditions: ConditionGroup | Condition[];
  priority: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Scoring Rule Types
// ============================================================================

export interface ScoringRule {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  points: number;
}

export interface CrmScoringRules {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  is_enabled: boolean;
  rules: ScoringRule[];
  score_field_key: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Cadence Types
// ============================================================================

export type CadenceStepType = 'task' | 'email' | 'call' | 'wait';

export interface CadenceTaskStep {
  type: 'task';
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: 'owner' | 'creator' | string;
}

export interface CadenceEmailStep {
  type: 'email';
  templateId?: string;
  subject?: string;
  body?: string;
}

export interface CadenceCallStep {
  type: 'call';
  script?: string;
  assignedTo?: 'owner' | 'creator' | string;
}

export interface CadenceWaitStep {
  type: 'wait';
  days: number;
}

export interface CadenceStep {
  id: string;
  type: CadenceStepType;
  delayDays: number; // Days to wait before this step
  config: CadenceTaskStep | CadenceEmailStep | CadenceCallStep | CadenceWaitStep;
  order: number;
}

export interface CrmCadence {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  steps: CadenceStep[];
  created_at: string;
  updated_at: string;
}

export type CadenceEnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface CrmCadenceEnrollment {
  id: string;
  org_id: string;
  cadence_id: string;
  record_id: string;
  status: CadenceEnrollmentStatus;
  current_step: number;
  next_step_at: string | null;
  state: Record<string, unknown>;
  enrolled_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SLA Types
// ============================================================================

export interface SlaEscalation {
  afterHours: number;
  notifyUsers: string[];
  updateField?: { field: string; value: unknown };
}

export interface CrmSlaPolicy {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  config: {
    responseHours: number;
    escalations: SlaEscalation[];
    conditions?: ConditionGroup | Condition[];
    trackingField?: string; // Field that stores SLA start time
  };
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Webform Types
// ============================================================================

export interface WebformFieldConfig {
  fieldKey: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  width?: 'full' | 'half';
}

export interface WebformSection {
  key: string;
  label: string;
  fields: WebformFieldConfig[];
}

export interface CrmWebform {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  slug: string;
  description: string | null;
  layout: {
    sections: WebformSection[];
  };
  hidden_fields: Record<string, unknown>;
  dedupe_config: {
    enabled: boolean;
    fields: string[];
    strategy: 'update' | 'skip' | 'create_duplicate';
  };
  success_message: string;
  redirect_url: string | null;
  is_enabled: boolean;
  submit_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface CrmNotification {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  body: string | null;
  href: string | null;
  icon: string;
  is_read: boolean;
  meta: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Automation Run Types
// ============================================================================

export type AutomationSource = 'workflow' | 'assignment' | 'scoring' | 'cadence' | 'sla' | 'webform' | 'macro';
export type AutomationRunStatus = 'running' | 'success' | 'failed' | 'skipped' | 'dry_run';

export interface ActionResult {
  actionId: string;
  type: ActionType;
  status: 'success' | 'failed' | 'skipped';
  output?: Record<string, unknown>;
  error?: string;
}

export interface CrmAutomationRun {
  id: string;
  org_id: string;
  workflow_id: string | null;
  source: AutomationSource;
  trigger: string;
  module_id: string | null;
  record_id: string | null;
  status: AutomationRunStatus;
  is_dry_run: boolean;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  actions_executed: ActionResult[];
  error: string | null;
  idempotency_key: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================================================
// Execution Context Types
// ============================================================================

export interface AutomationContext {
  orgId: string;
  moduleId: string;
  record: CrmRecord;
  previousRecord?: CrmRecord;
  trigger: TriggerType;
  dryRun: boolean;
  userId?: string;
  profileId?: string;
  idempotencyKey?: string;
}

export interface ExecuteWorkflowOptions {
  workflowId?: string;
  workflow?: CrmWorkflow;
  record: CrmRecord;
  trigger: TriggerType;
  previousRecord?: CrmRecord;
  dryRun?: boolean;
  idempotencyKey?: string;
  userId?: string;
  profileId?: string;
}

export interface ExecuteAllWorkflowsOptions {
  orgId: string;
  moduleId: string;
  record: CrmRecord;
  trigger: TriggerType;
  previousRecord?: CrmRecord;
  dryRun?: boolean;
  userId?: string;
  profileId?: string;
}

export interface AutomationRunResult {
  runId: string;
  workflowId?: string;
  workflowName?: string;
  status: AutomationRunStatus;
  actionsExecuted: ActionResult[];
  output: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface FieldValue {
  system: boolean; // Whether it's a system field or custom field
  key: string;
  value: unknown;
}

export const MAX_ACTIONS_PER_RUN = 50;
