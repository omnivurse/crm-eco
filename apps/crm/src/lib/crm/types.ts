/**
 * CRM TypeScript Type Definitions
 */

// ============================================================================
// CRM Modules
// ============================================================================

export interface CrmModule {
  id: string;
  org_id: string;
  key: string;
  name: string;
  name_plural: string | null;
  icon: string;
  description: string | null;
  is_system: boolean;
  is_enabled: boolean;
  display_order: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CRM Fields
// ============================================================================

export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'date' 
  | 'datetime' 
  | 'select' 
  | 'multiselect' 
  | 'boolean' 
  | 'email' 
  | 'phone' 
  | 'url' 
  | 'currency' 
  | 'lookup' 
  | 'user';

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
}

export interface CrmField {
  id: string;
  org_id: string;
  module_id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  is_system: boolean;
  is_indexed: boolean;
  is_title_field: boolean;
  options: string[];
  validation: FieldValidation;
  default_value: string | null;
  tooltip: string | null;
  display_order: number;
  section: string;
  width: 'full' | 'half';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CRM Layouts
// ============================================================================

export interface LayoutSection {
  key: string;
  label: string;
  columns: 1 | 2;
  collapsed?: boolean;
}

export interface LayoutConfig {
  sections: LayoutSection[];
}

export interface CrmLayout {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  is_default: boolean;
  config: LayoutConfig;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CRM Views
// ============================================================================

export interface ViewFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'gte' | 'lt' | 'lte' | 'is_null' | 'is_not_null';
  value: string | number | boolean | null;
}

export interface ViewSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CrmView {
  id: string;
  org_id: string;
  module_id: string;
  name: string;
  columns: string[];
  filters: ViewFilter[];
  sort: ViewSort[];
  is_default: boolean;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CRM Records
// ============================================================================

export interface CrmRecord {
  id: string;
  org_id: string;
  module_id: string;
  owner_id: string | null;
  title: string | null;
  status: string | null;
  stage: string | null;
  email: string | null;
  phone: string | null;
  system: Record<string, unknown>;
  data: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmRecordWithModule extends CrmRecord {
  module: CrmModule;
}

// ============================================================================
// CRM Notes
// ============================================================================

export interface CrmNote {
  id: string;
  org_id: string;
  record_id: string;
  body: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmNoteWithAuthor extends CrmNote {
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// ============================================================================
// CRM Tasks
// ============================================================================

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export type ActivityType = 'task' | 'call' | 'meeting' | 'email';
export type CallResult = 'connected' | 'left_voicemail' | 'no_answer' | 'busy' | 'wrong_number';
export type CallType = 'outbound' | 'inbound';
export type MeetingType = 'in_person' | 'video' | 'phone';

export interface CrmTask {
  id: string;
  org_id: string;
  record_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Activity type fields
  activity_type: ActivityType;
  call_duration: number | null;
  call_result: CallResult | null;
  call_type: CallType | null;
  meeting_location: string | null;
  meeting_type: MeetingType | null;
  attendees: string[] | null;
  reminder_at: string | null;
  outcome: string | null;
}

export interface CrmTaskWithAssignee extends CrmTask {
  assignee?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// Alias for semantic clarity
export type CrmActivity = CrmTask;
export type CrmActivityWithAssignee = CrmTaskWithAssignee;

// ============================================================================
// CRM Deal Stages
// ============================================================================

export interface CrmDealStage {
  id: string;
  org_id: string;
  name: string;
  key: string;
  color: string;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CRM Deal Stage History
// ============================================================================

export interface CrmStageHistory {
  id: string;
  org_id: string;
  record_id: string;
  from_stage: string | null;
  to_stage: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  duration_seconds: number | null;
  changed_by: string | null;
  reason: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface CrmStageHistoryWithUser extends CrmStageHistory {
  changed_by_name: string | null;
}

// ============================================================================
// CRM Record Links
// ============================================================================

export interface CrmRecordLink {
  id: string;
  org_id: string;
  source_record_id: string;
  target_record_id: string;
  link_type: string;
  is_primary: boolean;
  meta: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface CrmLinkedRecord {
  link_id: string;
  link_type: string;
  is_primary: boolean;
  direction: 'outbound' | 'inbound';
  record_id: string;
  record_title: string | null;
  record_module_key: string;
  record_module_name: string;
  created_at: string;
}

// ============================================================================
// CRM Attachments (Extended)
// ============================================================================

export interface CrmAttachment {
  id: string;
  org_id: string;
  record_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  meta: Record<string, unknown>;
  bucket_path: string | null;
  storage_bucket: string;
  is_public: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CrmAttachmentWithAuthor extends CrmAttachment {
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// ============================================================================
// CRM Timeline Events
// ============================================================================

export type TimelineEventType = 'stage_change' | 'activity' | 'note' | 'attachment' | 'audit' | 'message';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  data: CrmStageHistoryWithUser | CrmTaskWithAssignee | CrmNoteWithAuthor | CrmAttachmentWithAuthor | CrmAuditLogWithActor;
}

// ============================================================================
// CRM Relations
// ============================================================================

export interface CrmRelation {
  id: string;
  org_id: string;
  from_record_id: string;
  to_record_id: string;
  relation_type: string;
  meta: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface CrmRelationWithRecords extends CrmRelation {
  from_record: CrmRecord;
  to_record: CrmRecord;
}

// ============================================================================
// CRM Audit Log
// ============================================================================

export type AuditAction = 'create' | 'update' | 'delete' | 'import' | 'export' | 'bulk_update';

export interface CrmAuditLog {
  id: string;
  org_id: string;
  actor_id: string | null;
  action: AuditAction;
  entity: string;
  entity_id: string;
  diff: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface CrmAuditLogWithActor extends CrmAuditLog {
  actor?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// ============================================================================
// CRM Import
// ============================================================================

export type ImportStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ImportRowStatus = 'pending' | 'inserted' | 'updated' | 'skipped' | 'error';
export type ImportMatchType = 'new' | 'exact_match' | 'fuzzy_match' | 'duplicate';

export interface CrmImportMapping {
  id: string;
  org_id: string;
  module_id: string;
  source_id: string | null;
  name: string;
  mapping: Record<string, string>;
  transforms: Record<string, unknown>;
  dedupe_fields: string[];
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmImportJob {
  id: string;
  org_id: string;
  module_id: string;
  mapping_id: string | null;
  source_type: string;
  file_name: string | null;
  status: ImportStatus;
  total_rows: number;
  processed_rows: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  stats: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CrmImportRow {
  id: string;
  job_id: string;
  row_index: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown> | null;
  record_id: string | null;
  status: ImportRowStatus;
  match_type: ImportMatchType | null;
  error: string | null;
  warnings: string[];
  created_at: string;
}

// ============================================================================
// Dashboard Stats Queries
// ============================================================================

export interface ModuleStats {
  moduleKey: string;
  moduleName: string;
  totalRecords: number;
  createdThisWeek: number;
}

// ============================================================================
// User & Profile Context
// ============================================================================

export type CrmRole = 'crm_admin' | 'crm_manager' | 'crm_agent' | 'crm_viewer';

export interface CrmProfile {
  id: string;
  user_id: string;
  organization_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  crm_role: CrmRole | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmUserContext {
  user: {
    id: string;
    email: string;
  };
  profile: CrmProfile;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canImport: boolean;
    canManageSettings: boolean;
  };
}

// ============================================================================
// Dashboard & Stats
// ============================================================================

export interface ModuleStats {
  moduleKey: string;
  moduleName: string;
  totalRecords: number;
  createdThisWeek: number;
}