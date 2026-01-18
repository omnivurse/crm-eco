export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export type NodeType =
  // Triggers
  | 'trigger_record_created'
  | 'trigger_record_updated'
  | 'trigger_field_changed'
  | 'trigger_stage_changed'
  | 'trigger_scheduled'
  // Conditions
  | 'condition_if'
  | 'condition_switch'
  | 'condition_filter'
  // Actions
  | 'action_update_field'
  | 'action_send_email'
  | 'action_send_sms'
  | 'action_create_task'
  | 'action_assign_owner'
  | 'action_add_tag'
  | 'action_remove_tag'
  | 'action_webhook'
  // Flow Control
  | 'flow_wait'
  | 'flow_split'
  | 'flow_merge';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  next_nodes?: string[]; // IDs of connected nodes
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string; // For conditional branches
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  module_id?: string;
  trigger_config: Record<string, unknown>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_by: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  run_count: number;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  module_id?: string;
  trigger_config?: Record<string, unknown>;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  module_id?: string;
  trigger_config?: Record<string, unknown>;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

// Node definitions for the palette
export interface NodeDefinition {
  type: NodeType;
  category: 'trigger' | 'condition' | 'action' | 'flow';
  label: string;
  description: string;
  icon: string;
  color: string;
  configFields?: ConfigField[];
  maxInputs?: number;
  maxOutputs?: number;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'field_picker' | 'template' | 'json';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: unknown;
}

// Execution tracking
export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  record_id?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  current_node_id?: string;
  error_message?: string;
  execution_log: ExecutionLogEntry[];
}

export interface ExecutionLogEntry {
  timestamp: string;
  node_id: string;
  action: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  data?: Record<string, unknown>;
}
