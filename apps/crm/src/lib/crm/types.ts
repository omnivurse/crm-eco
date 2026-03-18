/**
 * CRM TypeScript Type Definitions
 */

// ============================================================================
// CRM View Modes
// ============================================================================

export type ViewMode = 'table' | 'list' | 'kanban' | 'chart' | 'timeline' | 'split' | 'tree';

export const VIEW_MODES: ViewMode[] = ['table', 'list', 'kanban', 'chart', 'timeline', 'split'];

// ============================================================================
// Tree View Types
// ============================================================================

export type TreeGroupBy = 'advisor' | 'agent';

export interface AdvisorTreeNode {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  commission_tier: string | null;
  agency_name: string | null;
  parent_advisor_id: string | null;
  producer_code: string | null;
  children: AdvisorTreeNode[];
  recordCount: number;
}

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
// CRM Territories
// ============================================================================

export interface CrmTerritory {
  id: string;
  org_id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
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
  is_pinned: boolean; // Starred/pinned fields always show in forms & list views
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

// Standard filter operators
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_null'
  | 'is_not_null'
  | 'in'
  | 'not_in'
  // Date preset operators
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'last_n_days'
  | 'next_n_days'
  | 'between';

/** Filter category discriminator for the unified ViewFilter type */
export type FilterCategory = 'field' | 'system' | 'related';

/** System-level preset filters backed by database queries */
export type SystemFilterPreset =
  | 'touched_records'
  | 'untouched_records'
  | 'my_records'
  | 'created_today'
  | 'created_this_week'
  | 'modified_today'
  | 'modified_this_week'
  | 'unassigned'
  | 'has_activities'
  | 'no_activities'
  | 'has_notes'
  | 'has_open_tasks'
  | 'has_overdue_tasks'
  // Toggle-only presets
  | 'locked'
  | 'website_activity'
  | 'chats'
  | 'campaigns'
  | 'cadences'
  // Value-based presets
  | 'record_action'
  | 'related_records_action'
  | 'scoring_rules'
  | 'latest_email_status'
  | 'attended_by'
  | 'browser'
  | 'operating_system'
  | 'portal_name'
  | 'search_engine'
  | 'time_spent_minutes'
  | 'time_visited'
  | 'avg_time_spent_minutes'
  | 'days_visited'
  | 'first_page_visited'
  | 'first_visit'
  | 'most_recent_visit'
  | 'number_of_chats'
  | 'referrer'
  | 'visitor_score'
  // Business lane & normalization presets (Phase 3)
  | 'healthshare_records'
  | 'insurance_records'
  | 'unclassified_records'
  | 'needs_review_records';

/** Related module filter condition */
export type RelatedFilterCondition = 'has_any' | 'has_none' | 'count_gt' | 'count_lt';

export interface ViewFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | null;
  // For 'last_n_days', 'next_n_days' - number of days
  // For 'between' - use secondValue for end date
  secondValue?: string | number | null;
  /** Filter category -- defaults to 'field' for backward compatibility */
  category?: FilterCategory;
  /** System preset identifier (only when category === 'system') */
  systemPreset?: SystemFilterPreset;
  /** Related module key (only when category === 'related') */
  relatedModule?: string;
  /** Related module filter condition (only when category === 'related') */
  relatedCondition?: RelatedFilterCondition;
}

// Date preset definitions for UI
export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface DatePresetOption {
  value: DatePreset;
  label: string;
  operator: FilterOperator;
  // For 'last_n_days' type operators
  days?: number;
}

// Quick filter presets
export type QuickFilterType =
  | 'my_records'
  | 'recently_viewed'
  | 'created_today'
  | 'created_this_week'
  | 'modified_today'
  | 'unassigned'
  | 'overdue';

export interface QuickFilter {
  type: QuickFilterType;
  label: string;
  icon?: string;
  getFilters: (userId: string) => ViewFilter[];
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
  advisor_id: string | null;
  contact_type: ContactType | null;
  is_medicaid: boolean;
  medicaid_start_date: string | null;
  medicaid_end_date: string | null;
  medicaid_state: string | null;
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
// CRM Pipelines
// ============================================================================

export type PipelineType = 'standard' | 'lead' | 'enrollment' | 'support' | 'custom';

export interface CrmPipeline {
  id: string;
  organization_id: string;
  module_id: string | null;
  name: string;
  key: string;
  description: string | null;
  pipeline_type: PipelineType;
  is_default: boolean;
  is_active: boolean;
  color: string;
  icon: string;
  display_order: number;
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmPipelineStage {
  id: string;
  pipeline_id: string;
  organization_id: string;
  name: string;
  key: string;
  color: string;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  display_order: number;
  is_active: boolean;
  required_fields: string[];
  allowed_from: string[] | null;
  allowed_to: string[] | null;
  auto_actions: unknown[];
  sla_hours: number | null;
  rotting_days: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrmStagePermission {
  id: string;
  stage_id: string;
  organization_id: string;
  role: string | null;
  user_id: string | null;
  can_enter: boolean;
  can_exit: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmPipelineWithStages extends CrmPipeline {
  crm_pipeline_stages: CrmPipelineStage[];
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

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'export'
  | 'bulk_update'
  | 'stage_change'
  | 'approval_request'
  | 'approval_action'
  | 'approval_apply'
  | 'message_sent'
  | 'rule_triggered';

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
// CRM Export Jobs
// ============================================================================

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired';
export type ExportType = 'records' | 'report' | 'audit_logs' | 'analytics' | 'backup';
export type ExportFormat = 'csv' | 'json' | 'xlsx';

export interface CrmExportJob {
  id: string;
  organization_id: string;
  module_id: string | null;
  name: string | null;
  export_type: ExportType;
  format: ExportFormat;
  columns: string[] | null;
  column_labels: Record<string, string>;
  filters: Record<string, unknown>;
  sort_by: string | null;
  sort_order: 'asc' | 'desc';
  status: ExportStatus;
  total_rows: number;
  processed_rows: number;
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  expires_at: string | null;
  error_message: string | null;
  stats: Record<string, unknown>;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ============================================================================
// CRM Data Administration Jobs
// ============================================================================

export type DataJobType = 'deduplicate' | 'merge' | 'mass_update' | 'mass_delete' | 'enrich';
export type DataJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'review';

export interface CrmDataJob {
  id: string;
  organization_id: string;
  module_id: string | null;
  job_type: DataJobType;
  name: string | null;
  status: DataJobStatus;
  config: Record<string, unknown>;
  filters: Record<string, unknown>;
  total_records: number;
  processed: number;
  affected: number;
  skipped: number;
  error_count: number;
  results: Record<string, unknown>;
  error_message: string | null;
  created_by: string | null;
  approved_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ============================================================================
// CRM Signals (Experience Center)
// ============================================================================

export type SignalCategory = 'engagement' | 'risk' | 'opportunity' | 'compliance' | 'lifecycle' | 'health' | 'activity' | 'custom';
export type SignalSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type SignalTriggerType = 'condition' | 'threshold' | 'inactivity' | 'scheduled' | 'manual';
export type SignalEventStatus = 'active' | 'resolved' | 'dismissed' | 'expired';

export interface CrmSignal {
  id: string;
  organization_id: string;
  module_id: string | null;
  name: string;
  key: string;
  description: string | null;
  category: SignalCategory;
  severity: SignalSeverity;
  icon: string;
  color: string;
  trigger_type: SignalTriggerType;
  conditions: unknown[];
  threshold_field: string | null;
  threshold_op: string | null;
  threshold_value: unknown;
  inactivity_days: number | null;
  inactivity_field: string | null;
  cron_expression: string | null;
  auto_resolve: boolean;
  resolve_after_days: number | null;
  on_fire_actions: unknown[];
  on_resolve_actions: unknown[];
  is_enabled: boolean;
  is_system: boolean;
  fire_count: number;
  last_evaluated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmSignalEvent {
  id: string;
  organization_id: string;
  signal_id: string;
  record_id: string | null;
  status: SignalEventStatus;
  severity: string;
  trigger_data: Record<string, unknown>;
  message: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  fired_at: string;
  expires_at: string | null;
  created_at: string;
}

export interface CrmSignalEventWithSignal extends CrmSignalEvent {
  signal: {
    name: string;
    key: string;
    category: string;
    icon: string;
    color: string;
  };
}

// ============================================================================
// CRM Segmentations (Experience Center)
// ============================================================================

export type SegmentType = 'dynamic' | 'static' | 'smart';

export interface CrmSegmentation {
  id: string;
  organization_id: string;
  module_id: string | null;
  name: string;
  key: string;
  description: string | null;
  segment_type: SegmentType;
  icon: string;
  color: string;
  criteria: Record<string, unknown>;
  required_signals: string[];
  excluded_signals: string[];
  min_score: number | null;
  max_score: number | null;
  score_field: string;
  member_count: number;
  last_computed_at: string | null;
  compute_interval_hours: number;
  is_active: boolean;
  is_system: boolean;
  tags: string[];
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmSegmentMember {
  id: string;
  segment_id: string;
  record_id: string;
  organization_id: string;
  added_by: 'system' | 'manual' | 'import';
  added_at: string;
}

export interface CrmSegmentationWithMembers extends CrmSegmentation {
  members: CrmSegmentMember[];
}

// ============================================================================
// CRM Extensions (Marketplace)
// ============================================================================

export type ExtensionCategory = 'communication' | 'analytics' | 'automation' | 'data' | 'finance' | 'compliance' | 'productivity' | 'utility' | 'custom';
export type ExtensionType = 'plugin' | 'integration' | 'theme' | 'widget' | 'automation' | 'report';
export type ExtensionStatus = 'draft' | 'review' | 'published' | 'deprecated' | 'archived';
export type ExtensionInstallStatus = 'active' | 'disabled' | 'suspended' | 'pending_upgrade' | 'trial' | 'expired' | 'error';

export interface CrmExtension {
  id: string;
  name: string;
  key: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  provider: string;
  provider_name: string;
  provider_url: string | null;
  category: ExtensionCategory;
  tags: string[];
  version: string;
  min_app_version: string | null;
  changelog: unknown[];
  icon: string;
  icon_url: string | null;
  banner_url: string | null;
  screenshots: string[];
  color: string;
  config_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  required_scopes: string[];
  extension_type: ExtensionType;
  entry_points: Record<string, unknown>;
  hooks: Record<string, unknown>;
  status: ExtensionStatus;
  is_featured: boolean;
  is_verified: boolean;
  is_free: boolean;
  price_monthly: number | null;
  price_yearly: number | null;
  trial_days: number;
  install_count: number;
  rating_avg: number;
  rating_count: number;
  documentation_url: string | null;
  support_url: string | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrmExtensionWithInstallStatus extends CrmExtension {
  installed: boolean;
  install_status: ExtensionInstallStatus | null;
}

export interface CrmExtensionInstall {
  id: string;
  organization_id: string;
  extension_id: string;
  installed_version: string;
  config: Record<string, unknown>;
  granted_scopes: string[];
  status: ExtensionInstallStatus;
  error_message: string | null;
  license_key: string | null;
  trial_ends_at: string | null;
  subscription_id: string | null;
  last_used_at: string | null;
  usage_count: number;
  installed_by: string | null;
  installed_at: string;
  enabled_at: string | null;
  disabled_at: string | null;
  updated_at: string;
}

export interface CrmExtensionInstallWithExtension extends CrmExtensionInstall {
  extension: Pick<CrmExtension,
    'name' | 'key' | 'slug' | 'description' | 'category' | 'extension_type' |
    'icon' | 'icon_url' | 'color' | 'version' | 'provider_name' | 'is_free'
  >;
}

export interface CrmExtensionReview {
  id: string;
  extension_id: string;
  organization_id: string;
  reviewer_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmExtensionReviewWithReviewer extends CrmExtensionReview {
  reviewer: {
    full_name: string;
    avatar_url: string | null;
  };
}

// ============================================================================
// CRM API Keys (Developer Hub)
// ============================================================================

export type ApiKeyStatus = 'active' | 'disabled' | 'revoked' | 'expired';
export type ApiKeyEnvironment = 'production' | 'staging' | 'development' | 'test';

export type ApiScope =
  | 'crm.read' | 'crm.write' | 'crm.admin'
  | 'records.read' | 'records.write' | 'records.delete'
  | 'contacts.read' | 'contacts.write'
  | 'pipelines.read' | 'pipelines.write'
  | 'automations.read' | 'automations.write'
  | 'analytics.read'
  | 'import.execute' | 'export.execute'
  | 'webhooks.manage'
  | 'extensions.read' | 'extensions.manage';

export interface CrmApiKey {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  scopes: ApiScope[];
  allowed_ips: string[];
  allowed_origins: string[];
  rate_limit_rpm: number;
  status: ApiKeyStatus;
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  usage_count: number;
  environment: ApiKeyEnvironment;
  created_by: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmApiKeyWithSecret extends CrmApiKey {
  key: string;  // Full key, only returned on creation
}

// ============================================================================
// CRM Webhooks (Developer Hub)
// ============================================================================

export type WebhookStatus = 'active' | 'disabled' | 'failed' | 'suspended';
export type WebhookAuthType = 'hmac_sha256' | 'basic' | 'bearer' | 'none';
export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export type WebhookEvent =
  | 'record.created' | 'record.updated' | 'record.deleted' | 'record.stage_changed'
  | 'contact.created' | 'contact.updated' | 'contact.deleted'
  | 'deal.created' | 'deal.updated' | 'deal.won' | 'deal.lost'
  | 'task.created' | 'task.completed'
  | 'note.created'
  | 'import.completed' | 'export.completed'
  | 'pipeline.stage_changed'
  | 'signal.fired' | 'signal.resolved'
  | 'extension.installed' | 'extension.uninstalled'
  | 'api_key.created' | 'api_key.revoked';

export interface CrmWebhook {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  url: string;
  events: WebhookEvent[];
  auth_type: WebhookAuthType;
  custom_headers: Record<string, string>;
  module_id: string | null;
  filters: Record<string, unknown>;
  timeout_ms: number;
  max_retries: number;
  retry_interval_seconds: number;
  status: WebhookStatus;
  is_verified: boolean;
  verified_at: string | null;
  delivery_count: number;
  success_count: number;
  failure_count: number;
  last_triggered_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Masked fields from API
  secret_masked?: string | null;
  has_auth?: boolean;
}

export interface CrmWebhookDelivery {
  id: string;
  webhook_id: string;
  organization_id: string;
  event_type: string;
  event_id: string | null;
  request_url: string;
  request_headers: Record<string, unknown>;
  request_body: Record<string, unknown>;
  response_status: number | null;
  response_headers: Record<string, unknown>;
  response_body: string | null;
  duration_ms: number | null;
  status: WebhookDeliveryStatus;
  error_message: string | null;
  attempt: number;
  max_attempts: number;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

// ============================================================================
// CRM API Logs (Developer Hub)
// ============================================================================

export interface CrmApiLog {
  id: string;
  organization_id: string;
  api_key_id: string | null;
  user_id: string | null;
  method: string;
  path: string;
  query_params: Record<string, unknown>;
  request_body: Record<string, unknown> | null;
  request_headers: Record<string, unknown>;
  response_status: number;
  response_body_size: number | null;
  ip_address: string | null;
  user_agent: string | null;
  duration_ms: number | null;
  resource_type: string | null;
  resource_id: string | null;
  action: string | null;
  error_code: string | null;
  error_message: string | null;
  rate_limited: boolean;
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
// Dual-Capacity Product Types
// ============================================================================

export type ProductType = 'health_insurance' | 'health_share';

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'health_insurance', label: 'Health Insurance' },
  { value: 'health_share', label: 'Health Share' },
];

// ============================================================================
// Email Campaigns
// ============================================================================

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'sent' | 'cancelled';
export type CampaignRecipientStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'failed'
  | 'unsubscribed'
  | 'skipped';

export interface EmailCampaign {
  id: string;
  org_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  unsubscribed_count: number;
  failed_count: number;
  module_key: string | null;
  view_id: string | null;
  filter_config: ViewFilter[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaignRecipient {
  id: string;
  campaign_id: string;
  record_id: string;
  module_key: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  merge_data: Record<string, unknown>;
  status: CampaignRecipientStatus;
  skip_reason: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  open_count: number;
  last_opened_at: string | null;
  clicked_at: string | null;
  click_count: number;
  last_clicked_at: string | null;
  bounced_at: string | null;
  bounce_type: string | null;
  bounce_reason: string | null;
  unsubscribed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  provider_message_id: string | null;
  tracking_id: string;
  created_at: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  failed: number;
  pending: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
}

export interface CampaignTrackingEvent {
  id: string;
  org_id: string;
  campaign_id: string;
  recipient_id: string;
  tracking_id: string;
  event_type: 'open' | 'click' | 'unsubscribe';
  ip_address: string | null;
  user_agent: string | null;
  clicked_url: string | null;
  created_at: string;
}

// ============================================================================
// Email Domains
// ============================================================================

export type DomainStatus = 'pending' | 'verifying' | 'verified' | 'failed';

export interface EmailDomain {
  id: string;
  org_id: string;
  domain: string;
  status: DomainStatus;
  dkim_selector: string | null;
  dkim_value: string | null;
  dkim_verified: boolean;
  dkim_verified_at: string | null;
  spf_value: string | null;
  spf_verified: boolean;
  spf_verified_at: string | null;
  dmarc_value: string | null;
  dmarc_verified: boolean;
  dmarc_verified_at: string | null;
  verification_token: string | null;
  verification_attempts: number;
  last_verification_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailSenderAddress {
  id: string;
  org_id: string;
  domain_id: string | null;
  email: string;
  name: string | null;
  reply_to: string | null;
  is_default: boolean;
  is_verified: boolean;
  verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Recent Views
// ============================================================================

export interface RecentView {
  id: string;
  org_id: string;
  user_id: string;
  record_id: string;
  module_id: string;
  viewed_at: string;
  view_count: number;
}

// ============================================================================
// CRM Advisors (Contact Hierarchy)
// ============================================================================

export type ContactType = 'lead' | 'member' | 'former_member';

export interface CrmAdvisor {
  id: string;
  organization_id: string;
  user_id: string | null;
  advisor_name: string;
  agency_name: string | null;
  state: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdvisorContactSummary {
  advisor_id: string;
  organization_id: string;
  advisor_name: string;
  agency_name: string | null;
  state: string | null;
  advisor_active: boolean;
  total_contacts: number;
  active_members: number;
  inactive_members: number;
  leads: number;
  contacts_this_month: number;
}

// ============================================================================
// CRM Contact Groups
// ============================================================================

export type ContactGroupType = 'status' | 'product' | 'source' | 'custom';

export interface CrmContactGroup {
  id: string;
  organization_id: string;
  group_name: string;
  group_type: ContactGroupType;
  description: string | null;
  color: string;
  icon: string;
  is_system: boolean;
  is_active: boolean;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContactGroupMember {
  id: string;
  group_id: string;
  record_id: string;
  organization_id: string;
  added_by: string | null;
  added_at: string;
}

export interface ContactGroupWithCount extends CrmContactGroup {
  member_count: number;
}

// ============================================================================
// Insurance Carriers & Plans (Carrier Database)
// ============================================================================

export type CarrierType = 'insurance' | 'healthshare' | 'medicaid' | 'short_term';
export type MetalLevel = 'catastrophic' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface InsuranceCarrier {
  id: string;
  organization_id: string;
  carrier_name: string;
  naic_code: string | null;
  website: string | null;
  logo_url: string | null;
  carrier_type: CarrierType;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InsurancePlan {
  id: string;
  organization_id: string;
  carrier_id: string;
  plan_name: string;
  plan_type: CarrierType;
  metal_level: MetalLevel | null;
  base_premium: number | null;
  tax_credit_estimate: number | null;
  deductible: number | null;
  max_out_of_pocket: number | null;
  copay_primary: number | null;
  copay_specialist: number | null;
  rx_coverage: boolean;
  dental_included: boolean;
  vision_included: boolean;
  hsa_eligible: boolean;
  plan_year: number | null;
  summary_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InsurancePlanWithCarrier extends InsurancePlan {
  carrier: Pick<InsuranceCarrier, 'carrier_name' | 'carrier_type' | 'logo_url'>;
}

export interface CarrierStateAvailability {
  id: string;
  carrier_id: string;
  organization_id: string;
  state: string;
  rating_area: string | null;
  marketplace_id: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// Premium Comparison Engine
// ============================================================================

export interface PremiumComparison {
  id: string;
  organization_id: string;
  record_id: string | null;
  comparison_name: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PremiumComparisonItem {
  id: string;
  comparison_id: string;
  plan_id: string | null;
  label: string;
  plan_type: CarrierType;
  full_premium: number;
  tax_credit: number;
  net_premium: number; // Generated column: full_premium - tax_credit
  deductible: number | null;
  max_oop: number | null;
  metal_level: string | null;
  display_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PremiumComparisonWithItems extends PremiumComparison {
  items: PremiumComparisonItem[];
}

export interface ComparisonSummary {
  comparison_id: string;
  organization_id: string;
  record_id: string | null;
  comparison_name: string;
  created_by: string | null;
  created_at: string;
  plan_count: number;
  best_net_premium: number | null;
  worst_net_premium: number | null;
  avg_net_premium: number | null;
}

export interface NetPremiumResult {
  gross_premium: number;
  tax_credit: number;
  net_premium: number;
}

// ============================================================================
// Medicaid Tracking
// ============================================================================

export interface MedicaidDashboardStats {
  organization_id: string;
  total_medicaid_members: number;
  active_medicaid: number;
  former_medicaid: number;
  transitioning_from_medicaid: number;
  new_medicaid_this_month: number;
}

export interface MedicaidStateBreakdown {
  organization_id: string;
  state: string;
  total: number;
  active: number;
  transitioning: number;
}

// ============================================================================
// Member Lifecycle Tracking
// ============================================================================

export type LifecycleEventType = 'enrolled' | 'cancelled' | 'returned' | 'paused';

export type LifecycleReason =
  | 'cost'
  | 'coverage_change'
  | 'moved_state'
  | 'joined_medicaid'
  | 'joined_employer_plan'
  | 'dissatisfied'
  | 'non_payment'
  | 'aging_out'
  | 'life_event'
  | 'better_option'
  | 'voluntary'
  | 'involuntary'
  | 'other';

export interface MemberLifecycleEvent {
  id: string;
  organization_id: string;
  contact_id: string;
  event_type: LifecycleEventType;
  event_date: string;
  reason: LifecycleReason | null;
  reason_detail: string | null;
  plan_type: CarrierType | null;
  advisor_id: string | null;
  source: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface MemberHistorySummary {
  contact_id: string;
  organization_id: string;
  contact_name: string | null;
  contact_email: string | null;
  advisor_id: string | null;
  total_events: number;
  enroll_count: number;
  cancel_count: number;
  return_count: number;
  pause_count: number;
  first_enrolled: string | null;
  last_event_date: string | null;
  current_status: LifecycleEventType | null;
  top_cancel_reason: LifecycleReason | null;
}

export interface LifecycleOrgStats {
  organization_id: string;
  total_tracked_members: number;
  enrolled_this_month: number;
  cancelled_this_month: number;
  total_returned: number;
  churn_rate_12m: number;
  top_cancel_reason: LifecycleReason | null;
}