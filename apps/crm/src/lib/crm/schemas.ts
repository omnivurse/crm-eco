/**
 * CRM Zod Validation Schemas
 */

import { z } from 'zod';

// ============================================================================
// Record Schemas
// ============================================================================

export const createRecordSchema = z.object({
  org_id: z.string().uuid(),
  module_id: z.string().uuid(),
  owner_id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  status: z.string().optional(),
  stage: z.string().optional(),
});

export const updateRecordSchema = z.object({
  id: z.string().uuid(),
  data: z.record(z.unknown()).optional(),
  owner_id: z.string().uuid().nullable().optional(),
  status: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});

export const bulkUpdateRecordsSchema = z.object({
  record_ids: z.array(z.string().uuid()).min(1),
  updates: z.object({
    owner_id: z.string().uuid().optional(),
    status: z.string().optional(),
    stage: z.string().optional(),
  }),
});

// ============================================================================
// Note Schemas
// ============================================================================

export const createNoteSchema = z.object({
  org_id: z.string().uuid(),
  record_id: z.string().uuid(),
  body: z.string().min(1, 'Note body is required'),
  is_pinned: z.boolean().optional(),
});

export const updateNoteSchema = z.object({
  id: z.string().uuid(),
  body: z.string().min(1, 'Note body is required'),
});

// ============================================================================
// Task Schemas
// ============================================================================

export const taskPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export const taskStatusSchema = z.enum(['open', 'in_progress', 'completed', 'cancelled']);

export const createTaskSchema = z.object({
  org_id: z.string().uuid(),
  record_id: z.string().uuid().optional(),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  due_at: z.string().datetime().optional(),
  priority: taskPrioritySchema.optional(),
  assigned_to: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

// ============================================================================
// Module Schemas
// ============================================================================

export const createModuleSchema = z.object({
  org_id: z.string().uuid(),
  key: z.string()
    .min(2, 'Key must be at least 2 characters')
    .max(50, 'Key must be at most 50 characters')
    .regex(/^[a-z][a-z0-9_]*$/, 'Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores'),
  name: z.string().min(1, 'Name is required').max(100),
  name_plural: z.string().max(100).optional(),
  icon: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const updateModuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  name_plural: z.string().max(100).optional(),
  icon: z.string().optional(),
  description: z.string().max(500).nullable().optional(),
  is_enabled: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
});

// ============================================================================
// Field Schemas
// ============================================================================

export const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'select',
  'multiselect',
  'boolean',
  'email',
  'phone',
  'url',
  'currency',
  'lookup',
  'user',
]);

export const fieldValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  pattern: z.string().optional(),
  message: z.string().optional(),
}).optional();

export const createFieldSchema = z.object({
  org_id: z.string().uuid(),
  module_id: z.string().uuid(),
  key: z.string()
    .min(2, 'Key must be at least 2 characters')
    .max(50, 'Key must be at most 50 characters')
    .regex(/^[a-z][a-z0-9_]*$/, 'Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores'),
  label: z.string().min(1, 'Label is required').max(100),
  type: fieldTypeSchema,
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  validation: fieldValidationSchema,
  default_value: z.string().optional(),
  tooltip: z.string().max(500).optional(),
  section: z.string().max(50).optional(),
});

export const updateFieldSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(100).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  validation: fieldValidationSchema,
  default_value: z.string().nullable().optional(),
  tooltip: z.string().max(500).nullable().optional(),
  section: z.string().max(50).optional(),
  display_order: z.number().int().min(0).optional(),
});

// ============================================================================
// View Schemas
// ============================================================================

export const viewFilterOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'ends_with',
  'gt',
  'gte',
  'lt',
  'lte',
  'is_null',
  'is_not_null',
]);

export const viewFilterSchema = z.object({
  field: z.string(),
  operator: viewFilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const viewSortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});

export const createViewSchema = z.object({
  org_id: z.string().uuid(),
  module_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100),
  columns: z.array(z.string()).min(1, 'At least one column is required'),
  filters: z.array(viewFilterSchema).optional(),
  sort: z.array(viewSortSchema).optional(),
  is_shared: z.boolean().optional(),
});

export const updateViewSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  columns: z.array(z.string()).min(1).optional(),
  filters: z.array(viewFilterSchema).optional(),
  sort: z.array(viewSortSchema).optional(),
  is_shared: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

// ============================================================================
// Import Schemas
// ============================================================================

export const importMappingSchema = z.record(z.string());

export const createImportMappingSchema = z.object({
  org_id: z.string().uuid(),
  module_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100),
  mapping: importMappingSchema,
  transforms: z.record(z.unknown()).optional(),
  dedupe_fields: z.array(z.string()).optional(),
});

export const importRowSchema = z.object({
  job_id: z.string().uuid(),
  row_index: z.number().int().min(0),
  raw: z.record(z.unknown()),
  normalized: z.record(z.unknown()).optional(),
});

// ============================================================================
// Dynamic Field Value Validation
// ============================================================================

export function createFieldValueSchema(
  fieldType: string,
  required: boolean,
  options?: string[],
  validation?: { min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: string }
) {
  let schema: z.ZodType;

  switch (fieldType) {
    case 'text':
    case 'textarea':
      schema = z.string();
      if (validation?.minLength) schema = (schema as z.ZodString).min(validation.minLength);
      if (validation?.maxLength) schema = (schema as z.ZodString).max(validation.maxLength);
      if (validation?.pattern) schema = (schema as z.ZodString).regex(new RegExp(validation.pattern));
      break;

    case 'email':
      schema = z.string().email('Invalid email address');
      break;

    case 'phone':
      schema = z.string().regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number');
      break;

    case 'url':
      schema = z.string().url('Invalid URL');
      break;

    case 'number':
    case 'currency':
      schema = z.number();
      if (validation?.min !== undefined) schema = (schema as z.ZodNumber).min(validation.min);
      if (validation?.max !== undefined) schema = (schema as z.ZodNumber).max(validation.max);
      break;

    case 'date':
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
      break;

    case 'datetime':
      schema = z.string().datetime('Invalid datetime format');
      break;

    case 'boolean':
      schema = z.boolean();
      break;

    case 'select':
      schema = options && options.length > 0
        ? z.enum(options as [string, ...string[]])
        : z.string();
      break;

    case 'multiselect':
      schema = options && options.length > 0
        ? z.array(z.enum(options as [string, ...string[]]))
        : z.array(z.string());
      break;

    case 'lookup':
    case 'user':
      schema = z.string().uuid();
      break;

    default:
      schema = z.unknown();
  }

  if (!required) {
    schema = schema.optional().nullable();
  }

  return schema;
}

// ============================================================================
// Type Exports
// ============================================================================

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type CreateViewInput = z.infer<typeof createViewSchema>;
export type UpdateViewInput = z.infer<typeof updateViewSchema>;
