/**
 * CRM Library Exports
 */

// Types - export everything
export * from './types';

// Queries - export everything  
export * from './queries';

// Mutations - export explicitly to avoid conflicts
export {
  createRecord,
  updateRecord,
  deleteRecord,
  bulkDeleteRecords,
  bulkUpdateRecords,
  createNote,
  updateNote,
  toggleNotePin,
  deleteNote,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  createModule,
  updateModule,
  createField,
  updateField,
  deleteField,
  createView,
  updateView,
  deleteView,
  createImportJob,
  updateImportJobStatus,
  insertImportRows,
  type CreateRecordInput,
  type UpdateRecordInput,
  type CreateNoteInput,
  type CreateTaskInput,
  type UpdateTaskInput,
  type CreateModuleInput,
  type CreateFieldInput,
  type CreateViewInput,
  type CreateImportJobInput,
} from './mutations';

// Schemas - export explicitly to avoid conflicts
export {
  createRecordSchema,
  updateRecordSchema,
  createNoteSchema,
  updateNoteSchema,
  createTaskSchema,
  updateTaskSchema,
  createModuleSchema,
  updateModuleSchema,
  createViewSchema,
  updateViewSchema,
} from './schemas';
