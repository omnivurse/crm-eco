// ============================================================================
// Email Sequence Types
// ============================================================================

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'archived';
export type TriggerType = 'manual' | 'on_create' | 'on_stage_change' | 'on_tag_add' | 'on_field_change';
export type StepType = 'email' | 'wait' | 'condition' | 'action';
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'exited' | 'bounced' | 'unsubscribed';

export interface EmailSequence {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  status: SequenceStatus;
  trigger_type?: TriggerType;
  trigger_config: TriggerConfig;
  exit_conditions: ExitCondition[];
  settings: SequenceSettings;
  total_enrolled: number;
  total_completed: number;
  total_exited: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  steps?: SequenceStep[];
}

export interface TriggerConfig {
  module_id?: string;
  module_key?: string;
  stage?: string;
  tag?: string;
  field?: string;
  operator?: string;
  value?: unknown;
}

export interface ExitCondition {
  type: 'reply_received' | 'link_clicked' | 'tag_added' | 'stage_changed' | 'field_changed' | 'unsubscribed';
  config?: Record<string, unknown>;
}

export interface SequenceSettings {
  send_on_weekends?: boolean;
  business_hours_only?: boolean;
  business_hours_start?: string; // e.g., "09:00"
  business_hours_end?: string; // e.g., "17:00"
  timezone?: string;
  track_opens?: boolean;
  track_clicks?: boolean;
  stop_on_reply?: boolean;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  step_type: StepType;
  name?: string;
  // Timing
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  send_time?: string;
  send_days: string[];
  // Email content
  template_id?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  from_name?: string;
  from_email?: string;
  // Condition/Action
  condition_config?: ConditionConfig;
  action_config?: ActionConfig;
  // A/B testing
  is_ab_test: boolean;
  ab_variants: ABVariant[];
  // Stats
  sent_count: number;
  open_count: number;
  click_count: number;
  reply_count: number;
  bounce_count: number;
  created_at: string;
}

export interface ConditionConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_set' | 'is_not_set';
  value?: unknown;
  then_step_id?: string;
  else_step_id?: string;
}

export interface ActionConfig {
  type: 'update_field' | 'add_tag' | 'remove_tag' | 'create_task' | 'notify_owner';
  field?: string;
  value?: unknown;
  tag?: string;
  task_title?: string;
  notify_message?: string;
}

export interface ABVariant {
  id: string;
  name: string;
  weight: number; // Percentage 0-100
  subject?: string;
  body_html?: string;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  record_id: string;
  module_key: string;
  email: string;
  current_step_id?: string;
  current_step_order: number;
  status: EnrollmentStatus;
  enrolled_at: string;
  enrolled_by?: string;
  last_step_at?: string;
  next_step_at?: string;
  completed_at?: string;
  exit_reason?: string;
  exited_at?: string;
  metadata: Record<string, unknown>;
  // Joined data
  sequence?: EmailSequence;
  record?: {
    id: string;
    title?: string;
    data?: Record<string, unknown>;
  };
}

export interface StepExecution {
  id: string;
  enrollment_id: string;
  step_id: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed' | 'skipped';
  executed_at: string;
  provider_message_id?: string;
  error_message?: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateSequenceRequest {
  name: string;
  description?: string;
  trigger_type?: TriggerType;
  trigger_config?: TriggerConfig;
  exit_conditions?: ExitCondition[];
  settings?: SequenceSettings;
}

export interface UpdateSequenceRequest extends Partial<CreateSequenceRequest> {
  status?: SequenceStatus;
}

export interface CreateStepRequest {
  step_type: StepType;
  name?: string;
  step_order?: number;
  delay_days?: number;
  delay_hours?: number;
  delay_minutes?: number;
  send_time?: string;
  send_days?: string[];
  template_id?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  from_name?: string;
  from_email?: string;
  condition_config?: ConditionConfig;
  action_config?: ActionConfig;
}

export interface EnrollRequest {
  record_ids: string[];
  module_key: string;
}

export interface SequenceStats {
  total_enrolled: number;
  active: number;
  completed: number;
  exited: number;
  paused: number;
  emails_sent: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
}
