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
}

export interface CrmTaskWithAssignee extends CrmTask {
  assignee?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
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
