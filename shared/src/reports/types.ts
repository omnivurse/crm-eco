import { z } from 'zod';

// ============================================================================
// DATA SOURCES
// ============================================================================

export const DATA_SOURCES = ['members', 'advisors', 'enrollments', 'commissions'] as const;
export type DataSource = typeof DATA_SOURCES[number];

// ============================================================================
// COLUMN DEFINITIONS
// ============================================================================

export const ColumnTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'datetime',
  'boolean',
  'currency',
  'percent',
  'email',
  'phone',
  'status',
  'json',
]);

export type ColumnType = z.infer<typeof ColumnTypeSchema>;

export interface ColumnDefinition {
  key: string;
  label: string;
  table: string;
  type: ColumnType;
  description?: string;
  format?: string;
  joinRequired?: string;
}

// ============================================================================
// FILTER DEFINITIONS
// ============================================================================

export const FilterOperatorSchema = z.enum([
  'eq',        // equals
  'neq',       // not equals
  'gt',        // greater than
  'gte',       // greater than or equal
  'lt',        // less than
  'lte',       // less than or equal
  'like',      // contains (case insensitive)
  'ilike',     // contains (case insensitive)
  'in',        // in list
  'nin',       // not in list
  'is_null',   // is null
  'is_not_null', // is not null
  'between',   // between two values
  'starts_with',
  'ends_with',
]);

export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

export const FilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number()])),
]);

export type FilterValue = z.infer<typeof FilterValueSchema>;

export const FilterSchema = z.object({
  column: z.string(),
  operator: FilterOperatorSchema,
  value: FilterValueSchema.optional(),
  value2: FilterValueSchema.optional(), // For 'between' operator
});

export type Filter = z.infer<typeof FilterSchema>;

// ============================================================================
// GROUPING & AGGREGATION
// ============================================================================

export const AggregationTypeSchema = z.enum([
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'count_distinct',
]);

export type AggregationType = z.infer<typeof AggregationTypeSchema>;

export const AggregationSchema = z.object({
  column: z.string(),
  type: AggregationTypeSchema,
  alias: z.string().optional(),
});

export type Aggregation = z.infer<typeof AggregationSchema>;

export const GroupingSchema = z.object({
  column: z.string(),
  label: z.string().optional(),
});

export type Grouping = z.infer<typeof GroupingSchema>;

// ============================================================================
// SORTING
// ============================================================================

export const SortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirectionSchema>;

export const SortingSchema = z.object({
  column: z.string(),
  direction: SortDirectionSchema,
});

export type Sorting = z.infer<typeof SortingSchema>;

// ============================================================================
// REPORT DEFINITION
// ============================================================================

export const ReportDefinitionSchema = z.object({
  dataSource: z.enum(DATA_SOURCES),
  columns: z.array(z.string()),
  filters: z.array(FilterSchema).default([]),
  grouping: z.array(GroupingSchema).default([]),
  aggregations: z.array(AggregationSchema).default([]),
  sorting: z.array(SortingSchema).default([]),
  limit: z.number().min(1).max(10000).default(100),
  offset: z.number().min(0).default(0),
});

export type ReportDefinition = z.infer<typeof ReportDefinitionSchema>;

// ============================================================================
// REPORT EXECUTION
// ============================================================================

export const ExecuteReportRequestSchema = ReportDefinitionSchema.extend({
  orgId: z.string().uuid(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(1000).default(50),
});

export type ExecuteReportRequest = z.infer<typeof ExecuteReportRequestSchema>;

export interface ReportResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// SAVED REPORT
// ============================================================================

export const SavedReportSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  dataSource: z.enum(DATA_SOURCES),
  columns: z.array(z.string()),
  filters: z.array(FilterSchema).default([]),
  grouping: z.array(GroupingSchema).default([]),
  aggregations: z.array(AggregationSchema).default([]),
  sorting: z.array(SortingSchema).default([]),
  isTemplate: z.boolean().default(false),
  templateCategory: z.string().optional(),
});

export type SavedReport = z.infer<typeof SavedReportSchema>;

// ============================================================================
// SCHEDULED REPORT
// ============================================================================

export const ScheduleTypeSchema = z.enum(['daily', 'weekly', 'monthly']);
export type ScheduleType = z.infer<typeof ScheduleTypeSchema>;

export const ExportFormatSchema = z.enum(['csv', 'excel', 'json']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const ScheduledReportSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  reportId: z.string().uuid(),
  name: z.string().min(1),
  scheduleType: ScheduleTypeSchema,
  scheduleConfig: z.record(z.any()).default({}),
  recipients: z.array(z.string().email()).default([]),
  exportFormat: ExportFormatSchema.default('csv'),
  isEnabled: z.boolean().default(true),
});

export type ScheduledReport = z.infer<typeof ScheduledReportSchema>;

// ============================================================================
// REPORT SEGMENT
// ============================================================================

export const SegmentEntityTypeSchema = z.enum(['members', 'advisors']);
export type SegmentEntityType = z.infer<typeof SegmentEntityTypeSchema>;

export const ReportSegmentSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  entityType: SegmentEntityTypeSchema,
  filterSnapshot: z.array(FilterSchema).optional(),
  recordCount: z.number().default(0),
  isDynamic: z.boolean().default(false),
});

export type ReportSegment = z.infer<typeof ReportSegmentSchema>;

// ============================================================================
// REPORT ALERT
// ============================================================================

export const AlertConditionTypeSchema = z.enum(['threshold', 'milestone', 'change']);
export type AlertConditionType = z.infer<typeof AlertConditionTypeSchema>;

export const ThresholdConditionSchema = z.object({
  metric: z.string(),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
  value: z.number(),
});

export const MilestoneConditionSchema = z.object({
  levelId: z.string().uuid().optional(),
  levelName: z.string().optional(),
});

export const ChangeConditionSchema = z.object({
  metric: z.string(),
  changeType: z.enum(['increase', 'decrease', 'any']),
  changePercent: z.number().optional(),
  changeValue: z.number().optional(),
});

export const AlertConditionConfigSchema = z.union([
  ThresholdConditionSchema,
  MilestoneConditionSchema,
  ChangeConditionSchema,
]);

export type AlertConditionConfig = z.infer<typeof AlertConditionConfigSchema>;

export const ReportAlertSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
  name: z.string().min(1),
  conditionType: AlertConditionTypeSchema,
  conditionConfig: AlertConditionConfigSchema,
  recipients: z.array(z.string().email()).default([]),
  isEnabled: z.boolean().default(true),
});

export type ReportAlert = z.infer<typeof ReportAlertSchema>;

// ============================================================================
// ADVISOR MILESTONE PROGRESS
// ============================================================================

export interface AgentLevel {
  id: string;
  name: string;
  rank: number;
  minActiveMembers: number;
  minMonthlyEnrollments: number;
  commissionRate: number;
  description?: string;
}

export interface AdvisorMilestoneProgress {
  id: string;
  orgId: string;
  advisorId: string;
  currentLevelId?: string;
  currentLevel?: AgentLevel;
  nextLevelId?: string;
  nextLevel?: AgentLevel;
  activeMembersCount: number;
  monthlyEnrollmentsCount: number;
  progressPercent: number;
  metricsSnapshot?: Record<string, unknown>;
  calculatedAt: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
  columns?: string[];
  dateFormat?: string;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
}
