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
  // W1 additions
  changeRecordStage,
  createDealStage,
  updateDealStage,
  deleteDealStage,
  createActivity,
  updateActivity,
  createRecordLink,
  updateRecordLink,
  deleteRecordLink,
  createAttachment,
  updateAttachment,
  deleteAttachment,
  type CreateRecordInput,
  type UpdateRecordInput,
  type CreateNoteInput,
  type CreateTaskInput,
  type UpdateTaskInput,
  type CreateModuleInput,
  type CreateFieldInput,
  type CreateViewInput,
  type CreateImportJobInput,
  type ChangeStageInput,
  type CreateDealStageInput,
  type CreateActivityInput,
  type UpdateActivityInput,
  type CreateRecordLinkInput,
  type CreateAttachmentInput,
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
