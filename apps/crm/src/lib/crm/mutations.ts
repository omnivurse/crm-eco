/**
 * CRM Supabase Mutation Functions
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  CrmRecord,
  CrmNote,
  CrmTask,
  CrmModule,
  CrmField,
  CrmView,
  CrmImportJob,
} from './types';

// ============================================================================
// Supabase Client Helper
// ============================================================================

export async function createCrmClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context
          }
        },
      },
    }
  );
}

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
