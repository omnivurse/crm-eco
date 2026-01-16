/**
 * CRM Automation Pack - Public Exports
 */

// Types
export * from './types';

// Conditions
export {
  resolveFieldValue,
  resolveFieldPath,
  evaluateCondition,
  evaluateConditionGroup,
  evaluateConditions,
  shouldTriggerOnUpdate,
  getChangedFields,
} from './conditions';

// Actions
export {
  executeAction,
  executeActions,
} from './actions';

// Engine
export {
  executeWorkflow,
  executeMatchingWorkflows,
  testWorkflow,
  createAutomationRun,
  completeAutomationRun,
} from './engine';

// Assignment
export {
  executeAssignment,
  findAndExecuteAssignment,
  getAssignmentStats,
} from './assignment';

// Scoring
export {
  calculateScore,
  applyScoring,
  recalculateModuleScores,
  getScoreDistribution,
} from './scoring';

// Cadence
export {
  processPendingCadenceSteps,
  enrollInCadence,
  unenrollFromCadence,
  pauseEnrollment,
  resumeEnrollment,
  getRecordEnrollments,
} from './cadence';

// Scheduler
export {
  scheduleJob,
  scheduleWorkflowStep,
  scheduleWorkflowRetry,
  scheduleWorkflowExecution,
  processScheduledJobs,
  processScheduledWorkflows,
  cancelSchedulerJob,
  getPendingJobsForEntity,
} from './scheduler';

// Macros
export {
  executeMacro,
  canExecuteMacro,
  getMacrosForRecord,
  getMacroRunsForRecord,
} from './macros';

// Queries
export {
  getWorkflows,
  getWorkflowById,
  getAssignmentRules,
  getScoringRules,
  getCadences,
  getCadenceEnrollments,
  getSlaPolicies,
  getWebforms,
  getWebformBySlug,
  getNotifications,
  getUnreadNotificationCount,
  getAutomationRuns,
  getAutomationRunById,
  getAutomationStats,
  // Macro queries
  getMacros,
  getMacroById,
  getMacrosForModule,
  getMacroRuns,
  // Workflow step queries
  getWorkflowSteps,
  getWorkflowRunLogs,
  // Scheduler queries
  getSchedulerJobs,
} from './queries';

// Mutations
export {
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  createAssignmentRule,
  updateAssignmentRule,
  deleteAssignmentRule,
  createScoringRules,
  updateScoringRules,
  deleteScoringRules,
  createCadence,
  updateCadence,
  deleteCadence,
  createSlaPolicy,
  updateSlaPolicy,
  deleteSlaPolicy,
  createWebform,
  updateWebform,
  deleteWebform,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  // Macro mutations
  createMacro,
  updateMacro,
  deleteMacro,
  toggleMacro,
} from './mutations';
