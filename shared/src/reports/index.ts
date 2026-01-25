// Types and schemas
export * from './types.js';

// Query engine
export {
  DATA_SOURCE_CONFIGS,
  getColumnsForDataSource,
  getColumnDefinition,
  buildQuery,
  buildSupabaseQuery,
  type QueryBuilderResult,
  type SupabaseQueryParams,
} from './query-engine.js';

// Templates
export {
  TEMPLATE_CATEGORIES,
  REPORT_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  getTemplatesByDataSource,
  convertTemplateToReport,
  type ReportTemplate,
  type TemplateCategory,
} from './templates.js';

// Milestone service
export {
  calculateMilestoneProgress,
  generateMilestoneNotification,
  getTierRequirementsBreakdown,
  mapDbRowToMilestoneProgress,
  mapDbRowToAgentLevel,
  type AdvisorMetrics,
  type MilestoneCalculationResult,
  type MilestoneNotification,
} from './milestone-service.js';

// Alert service
export {
  evaluateThresholdCondition,
  evaluateChangeCondition,
  evaluateAlert,
  evaluateAlerts,
  getTriggeredAlerts,
  createAlertNotification,
  type AlertEvaluationResult,
  type AlertNotification,
} from './alert-service.js';

// Export service
export {
  formatValueForExport,
  convertToCSV,
  exportToCSV,
  convertToExcelXML,
  exportToExcel,
  exportToJSON,
  exportData,
  downloadExport,
} from './export-service.js';
