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

export interface ViewFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | null;
  // For 'last_n_days', 'next_n_days' - number of days
  // For 'between' - use secondValue for end date
  secondValue?: string | number | null;
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