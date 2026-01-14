/**
 * CRM Supabase Mutation Functions
 */

import type {
  CrmRecord,
  CrmNote,
  CrmTask,
  CrmModule,
  CrmField,
  CrmView,
  CrmImportJob,
  CrmDealStage,
  CrmRecordLink,
  CrmAttachment,
  ActivityType,
  CallResult,
  CallType,
  MeetingType,
} from './types';
import { createCrmClient } from './queries';

// ============================================================================
// Record Mutations
// ============================================================================

export interface CreateRecordInput {
  org_id: string;
  module_id: string;
  owner_id?: string;
  data: Record<string, unknown>;
  status?: string;
  stage?: string;
}

export async function createRecord(input: CreateRecordInput): Promise<CrmRecord> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_records')
    .insert({
      org_id: input.org_id,
      module_id: input.module_id,
      owner_id: input.owner_id || profile?.id,
      data: input.data,
      status: input.status,
      stage: input.stage,
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmRecord;
}

export interface UpdateRecordInput {
  id: string;
  data?: Record<string, unknown>;
  owner_id?: string;
  status?: string;
  stage?: string;
  title?: string;
}

export async function updateRecord(input: UpdateRecordInput): Promise<CrmRecord> {
  const supabase = await createCrmClient();
  
  const updates: Record<string, unknown> = {};
  if (input.data !== undefined) updates.data = input.data;
  if (input.owner_id !== undefined) updates.owner_id = input.owner_id;
  if (input.status !== undefined) updates.status = input.status;
  if (input.stage !== undefined) updates.stage = input.stage;
  if (input.title !== undefined) updates.title = input.title;

  const { data, error } = await supabase
    .from('crm_records')
    .update(updates)
    .eq('id', input.id)
    .select()
    .single();

  if (error) throw error;
  return data as CrmRecord;
}

export async function deleteRecord(recordId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_records')
    .delete()
    .eq('id', recordId);

  if (error) throw error;
}

export async function bulkDeleteRecords(recordIds: string[]): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_records')
    .delete()
    .in('id', recordIds);

  if (error) throw error;
}

export async function bulkUpdateRecords(
  recordIds: string[],
  updates: Partial<Pick<CrmRecord, 'owner_id' | 'status' | 'stage'>>
): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_records')
    .update(updates)
    .in('id', recordIds);

  if (error) throw error;
}

// ============================================================================
// Note Mutations
// ============================================================================

export interface CreateNoteInput {
  org_id: string;
  record_id: string;
  body: string;
  is_pinned?: boolean;
}

export async function createNote(input: CreateNoteInput): Promise<CrmNote> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_notes')
    .insert({
      org_id: input.org_id,
      record_id: input.record_id,
      body: input.body,
      is_pinned: input.is_pinned || false,
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmNote;
}

export async function updateNote(noteId: string, body: string): Promise<CrmNote> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_notes')
    .update({ body })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmNote;
}

export async function toggleNotePin(noteId: string, isPinned: boolean): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_notes')
    .update({ is_pinned: isPinned })
    .eq('id', noteId);

  if (error) throw error;
}

export async function deleteNote(noteId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}

// ============================================================================
// Task Mutations
// ============================================================================

export interface CreateTaskInput {
  org_id: string;
  record_id?: string;
  title: string;
  description?: string;
  due_at?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to?: string;
}

export async function createTask(input: CreateTaskInput): Promise<CrmTask> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_tasks')
    .insert({
      org_id: input.org_id,
      record_id: input.record_id,
      title: input.title,
      description: input.description,
      due_at: input.due_at,
      priority: input.priority || 'normal',
      assigned_to: input.assigned_to || profile?.id,
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmTask;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  due_at?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'open' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: string;
}

export async function updateTask(input: UpdateTaskInput): Promise<CrmTask> {
  const supabase = await createCrmClient();
  
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.due_at !== undefined) updates.due_at = input.due_at;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
  }
  if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to;

  const { data, error } = await supabase
    .from('crm_tasks')
    .update(updates)
    .eq('id', input.id)
    .select()
    .single();

  if (error) throw error;
  return data as CrmTask;
}

export async function completeTask(taskId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_tasks')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
}

// ============================================================================
// Module Mutations (Admin only)
// ============================================================================

export interface CreateModuleInput {
  org_id: string;
  key: string;
  name: string;
  name_plural?: string;
  icon?: string;
  description?: string;
}

export async function createModule(input: CreateModuleInput): Promise<CrmModule> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_modules')
    .insert({
      org_id: input.org_id,
      key: input.key,
      name: input.name,
      name_plural: input.name_plural || input.name + 's',
      icon: input.icon || 'file',
      description: input.description,
      is_system: false,
      is_enabled: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmModule;
}

export async function updateModule(
  moduleId: string,
  updates: Partial<Pick<CrmModule, 'name' | 'name_plural' | 'icon' | 'description' | 'is_enabled' | 'display_order'>>
): Promise<CrmModule> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_modules')
    .update(updates)
    .eq('id', moduleId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmModule;
}

// ============================================================================
// Field Mutations (Admin only)
// ============================================================================

export interface CreateFieldInput {
  org_id: string;
  module_id: string;
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  validation?: Record<string, unknown>;
  default_value?: string;
  tooltip?: string;
  section?: string;
}

export async function createField(input: CreateFieldInput): Promise<CrmField> {
  const supabase = await createCrmClient();
  
  // Get max display_order
  const { data: existing } = await supabase
    .from('crm_fields')
    .select('display_order')
    .eq('module_id', input.module_id)
    .order('display_order', { ascending: false })
    .limit(1);

  const maxOrder = existing?.[0]?.display_order || 0;

  const { data, error } = await supabase
    .from('crm_fields')
    .insert({
      org_id: input.org_id,
      module_id: input.module_id,
      key: input.key,
      label: input.label,
      type: input.type,
      required: input.required || false,
      is_system: false,
      options: input.options || [],
      validation: input.validation || {},
      default_value: input.default_value,
      tooltip: input.tooltip,
      section: input.section || 'main',
      display_order: maxOrder + 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmField;
}

export async function updateField(
  fieldId: string,
  updates: Partial<Pick<CrmField, 'label' | 'required' | 'options' | 'validation' | 'default_value' | 'tooltip' | 'section' | 'display_order'>>
): Promise<CrmField> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_fields')
    .update(updates)
    .eq('id', fieldId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmField;
}

export async function deleteField(fieldId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_fields')
    .delete()
    .eq('id', fieldId);

  if (error) throw error;
}

// ============================================================================
// View Mutations
// ============================================================================

export interface CreateViewInput {
  org_id: string;
  module_id: string;
  name: string;
  columns: string[];
  filters?: Array<{ field: string; operator: string; value: unknown }>;
  sort?: Array<{ field: string; direction: string }>;
  is_shared?: boolean;
}

export async function createView(input: CreateViewInput): Promise<CrmView> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_views')
    .insert({
      org_id: input.org_id,
      module_id: input.module_id,
      name: input.name,
      columns: input.columns,
      filters: input.filters || [],
      sort: input.sort || [],
      is_shared: input.is_shared ?? true,
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmView;
}

export async function updateView(
  viewId: string,
  updates: Partial<Pick<CrmView, 'name' | 'columns' | 'filters' | 'sort' | 'is_shared' | 'is_default'>>
): Promise<CrmView> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_views')
    .update(updates)
    .eq('id', viewId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmView;
}

export async function deleteView(viewId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_views')
    .delete()
    .eq('id', viewId);

  if (error) throw error;
}

// ============================================================================
// Import Mutations
// ============================================================================

export interface CreateImportJobInput {
  org_id: string;
  module_id: string;
  source_type: string;
  file_name?: string;
  mapping_id?: string;
  total_rows: number;
}

export async function createImportJob(input: CreateImportJobInput): Promise<CrmImportJob> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_import_jobs')
    .insert({
      org_id: input.org_id,
      module_id: input.module_id,
      source_type: input.source_type,
      file_name: input.file_name,
      mapping_id: input.mapping_id,
      total_rows: input.total_rows,
      status: 'pending',
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmImportJob;
}

export async function updateImportJobStatus(
  jobId: string,
  status: string,
  stats?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  const supabase = await createCrmClient();
  
  const updates: Record<string, unknown> = { status };
  
  if (status === 'processing' && !stats) {
    updates.started_at = new Date().toISOString();
  }
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  if (stats) updates.stats = stats;
  if (errorMessage) updates.error_message = errorMessage;

  const { error } = await supabase
    .from('crm_import_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) throw error;
}

export async function insertImportRows(
  rows: Array<{
    job_id: string;
    row_index: number;
    raw: Record<string, unknown>;
    normalized?: Record<string, unknown>;
  }>
): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_import_rows')
    .insert(rows);

  if (error) throw error;
}

// ============================================================================
// Stage Change Mutations
// ============================================================================

export interface ChangeStageInput {
  recordId: string;
  newStage: string;
  reason?: string;
}

export async function changeRecordStage(input: ChangeStageInput): Promise<CrmRecord> {
  const supabase = await createCrmClient();
  
  // The trigger will automatically log the stage change
  const { data, error } = await supabase
    .from('crm_records')
    .update({ stage: input.newStage })
    .eq('id', input.recordId)
    .select()
    .single();

  if (error) throw error;
  
  // If a reason was provided, update the most recent history entry
  if (input.reason) {
    await supabase
      .from('crm_deal_stage_history')
      .update({ reason: input.reason })
      .eq('record_id', input.recordId)
      .order('created_at', { ascending: false })
      .limit(1);
  }
  
  return data as CrmRecord;
}

// ============================================================================
// Deal Stage Mutations
// ============================================================================

export interface CreateDealStageInput {
  org_id: string;
  key: string;
  name: string;
  color?: string;
  probability?: number;
  is_won?: boolean;
  is_lost?: boolean;
  display_order?: number;
}

export async function createDealStage(input: CreateDealStageInput): Promise<CrmDealStage> {
  const supabase = await createCrmClient();
  
  // Get max display_order if not provided
  let displayOrder = input.display_order;
  if (displayOrder === undefined) {
    const { data: existing } = await supabase
      .from('crm_deal_stages')
      .select('display_order')
      .eq('org_id', input.org_id)
      .order('display_order', { ascending: false })
      .limit(1);
    displayOrder = (existing?.[0]?.display_order || 0) + 1;
  }
  
  const { data, error } = await supabase
    .from('crm_deal_stages')
    .insert({
      org_id: input.org_id,
      key: input.key,
      name: input.name,
      color: input.color || '#6366f1',
      probability: input.probability || 0,
      is_won: input.is_won || false,
      is_lost: input.is_lost || false,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmDealStage;
}

export async function updateDealStage(
  stageId: string,
  updates: Partial<Pick<CrmDealStage, 'name' | 'color' | 'probability' | 'is_won' | 'is_lost' | 'display_order' | 'is_active'>>
): Promise<CrmDealStage> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_deal_stages')
    .update(updates)
    .eq('id', stageId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmDealStage;
}

export async function deleteDealStage(stageId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  // Soft delete by marking as inactive
  const { error } = await supabase
    .from('crm_deal_stages')
    .update({ is_active: false })
    .eq('id', stageId);

  if (error) throw error;
}

// ============================================================================
// Activity Mutations (extended tasks)
// ============================================================================

export interface CreateActivityInput {
  org_id: string;
  record_id?: string;
  title: string;
  description?: string;
  activity_type: ActivityType;
  due_at?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to?: string;
  // Call fields
  call_duration?: number;
  call_result?: CallResult;
  call_type?: CallType;
  // Meeting fields
  meeting_location?: string;
  meeting_type?: MeetingType;
  attendees?: string[];
  // Other fields
  reminder_at?: string;
  outcome?: string;
}

export async function createActivity(input: CreateActivityInput): Promise<CrmTask> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_tasks')
    .insert({
      org_id: input.org_id,
      record_id: input.record_id,
      title: input.title,
      description: input.description,
      activity_type: input.activity_type,
      due_at: input.due_at,
      priority: input.priority || 'normal',
      assigned_to: input.assigned_to || profile?.id,
      call_duration: input.call_duration,
      call_result: input.call_result,
      call_type: input.call_type,
      meeting_location: input.meeting_location,
      meeting_type: input.meeting_type,
      attendees: input.attendees,
      reminder_at: input.reminder_at,
      outcome: input.outcome,
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmTask;
}

export interface UpdateActivityInput {
  id: string;
  title?: string;
  description?: string;
  activity_type?: ActivityType;
  due_at?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'open' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: string;
  call_duration?: number | null;
  call_result?: CallResult | null;
  call_type?: CallType | null;
  meeting_location?: string | null;
  meeting_type?: MeetingType | null;
  attendees?: string[] | null;
  reminder_at?: string | null;
  outcome?: string | null;
}

export async function updateActivity(input: UpdateActivityInput): Promise<CrmTask> {
  const supabase = await createCrmClient();
  
  const updates: Record<string, unknown> = {};
  
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.activity_type !== undefined) updates.activity_type = input.activity_type;
  if (input.due_at !== undefined) updates.due_at = input.due_at;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
  }
  if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to;
  if (input.call_duration !== undefined) updates.call_duration = input.call_duration;
  if (input.call_result !== undefined) updates.call_result = input.call_result;
  if (input.call_type !== undefined) updates.call_type = input.call_type;
  if (input.meeting_location !== undefined) updates.meeting_location = input.meeting_location;
  if (input.meeting_type !== undefined) updates.meeting_type = input.meeting_type;
  if (input.attendees !== undefined) updates.attendees = input.attendees;
  if (input.reminder_at !== undefined) updates.reminder_at = input.reminder_at;
  if (input.outcome !== undefined) updates.outcome = input.outcome;

  const { data, error } = await supabase
    .from('crm_tasks')
    .update(updates)
    .eq('id', input.id)
    .select()
    .single();

  if (error) throw error;
  return data as CrmTask;
}

// ============================================================================
// Record Link Mutations
// ============================================================================

export interface CreateRecordLinkInput {
  org_id: string;
  source_record_id: string;
  target_record_id: string;
  link_type: string;
  is_primary?: boolean;
  meta?: Record<string, unknown>;
}

export async function createRecordLink(input: CreateRecordLinkInput): Promise<CrmRecordLink> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_record_links')
    .insert({
      org_id: input.org_id,
      source_record_id: input.source_record_id,
      target_record_id: input.target_record_id,
      link_type: input.link_type,
      is_primary: input.is_primary || false,
      meta: input.meta || {},
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmRecordLink;
}

export async function updateRecordLink(
  linkId: string,
  updates: Partial<Pick<CrmRecordLink, 'is_primary' | 'meta'>>
): Promise<CrmRecordLink> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_record_links')
    .update(updates)
    .eq('id', linkId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmRecordLink;
}

export async function deleteRecordLink(linkId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  const { error } = await supabase
    .from('crm_record_links')
    .delete()
    .eq('id', linkId);

  if (error) throw error;
}

// ============================================================================
// Attachment Mutations
// ============================================================================

export interface CreateAttachmentInput {
  org_id: string;
  record_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  bucket_path?: string;
  storage_bucket?: string;
  description?: string;
}

export async function createAttachment(input: CreateAttachmentInput): Promise<CrmAttachment> {
  const supabase = await createCrmClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data, error } = await supabase
    .from('crm_attachments')
    .insert({
      org_id: input.org_id,
      record_id: input.record_id,
      file_name: input.file_name,
      file_path: input.file_path,
      file_size: input.file_size,
      mime_type: input.mime_type,
      bucket_path: input.bucket_path,
      storage_bucket: input.storage_bucket || 'crm-attachments',
      description: input.description,
      created_by: profile?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CrmAttachment;
}

export async function updateAttachment(
  attachmentId: string,
  updates: Partial<Pick<CrmAttachment, 'description' | 'file_name'>>
): Promise<CrmAttachment> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_attachments')
    .update(updates)
    .eq('id', attachmentId)
    .select()
    .single();

  if (error) throw error;
  return data as CrmAttachment;
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const supabase = await createCrmClient();
  
  // Get attachment info first for storage cleanup
  const { data: attachment } = await supabase
    .from('crm_attachments')
    .select('bucket_path, storage_bucket')
    .eq('id', attachmentId)
    .single();
  
  // Delete from storage if bucket_path exists
  if (attachment?.bucket_path) {
    await supabase.storage
      .from(attachment.storage_bucket || 'crm-attachments')
      .remove([attachment.bucket_path]);
  }
  
  // Delete the record
  const { error } = await supabase
    .from('crm_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
}
