export type ReportType = 'tabular' | 'summary' | 'matrix';
export type ChartType = 'none' | 'bar' | 'line' | 'pie' | 'funnel' | 'area' | 'stacked_bar';
export type AggregationFunction = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type JoinType = 'inclusive' | 'exclusive'; // LEFT JOIN vs INNER JOIN

export interface RelatedModuleConfig {
  module_key: string;
  module_id: string;
  module_name: string;
  join_type: JoinType;
  relationship: 'child' | 'parent';
}

export interface FilterGroup {
  logic: 'and' | 'or';
  conditions: (ReportFilter | FilterGroup)[];
}

export interface ReportColumn {
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean' | 'select';
  width?: number;
  sortable?: boolean;
  module_key?: string;
}

export type ReportScope = 'all' | 'mine' | 'downline' | 'capacity';

export type ProductTypeFilter = 'health_insurance' | 'health_share' | null;

export interface ReportFilter {
  field: string;
  operator: string;
  value: unknown;
  value2?: unknown; // For 'between' operator
}

export interface ReportGrouping {
  field: string;
  order: 'asc' | 'desc';
}

export interface ReportAggregation {
  field: string;
  function: AggregationFunction;
  label?: string;
}

export interface ChartConfig {
  xAxis?: string;
  yAxis?: string;
  series?: string[];
  colors?: string[];
  showLegend?: boolean;
  showLabels?: boolean;
  stacked?: boolean;
}

export interface ReportSorting {
  column: string;
  direction: 'asc' | 'desc';
}

export interface CrmReport {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  module_id?: string;
  data_source?: string;
  report_type: ReportType;
  columns: ReportColumn[];
  filters: ReportFilter[];
  sorting: ReportSorting[];
  grouping: ReportGrouping[];
  aggregations: ReportAggregation[];
  chart_type: ChartType;
  chart_config: ChartConfig;
  related_modules: RelatedModuleConfig[];
  filter_logic: FilterGroup | null;
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Capacity/scope fields
  product_type_filter?: ProductTypeFilter;
  scope?: ReportScope;
  advisor_id?: string;
  include_downline?: boolean;
}

export interface CreateReportRequest {
  name: string;
  description?: string;
  module_id?: string;
  data_source?: string;
  report_type?: ReportType;
  columns?: ReportColumn[];
  filters?: ReportFilter[];
  sorting?: ReportSorting[];
  grouping?: ReportGrouping[];
  aggregations?: ReportAggregation[];
  chart_type?: ChartType;
  chart_config?: ChartConfig;
  related_modules?: RelatedModuleConfig[];
  filter_logic?: FilterGroup | null;
  is_shared?: boolean;
  product_type_filter?: ProductTypeFilter;
  scope?: ReportScope;
  advisor_id?: string;
  include_downline?: boolean;
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  module_id?: string;
  data_source?: string;
  report_type?: ReportType;
  columns?: ReportColumn[];
  filters?: ReportFilter[];
  sorting?: ReportSorting[];
  grouping?: ReportGrouping[];
  aggregations?: ReportAggregation[];
  chart_type?: ChartType;
  chart_config?: ChartConfig;
  related_modules?: RelatedModuleConfig[];
  filter_logic?: FilterGroup | null;
  is_shared?: boolean;
  product_type_filter?: ProductTypeFilter;
  scope?: ReportScope;
  advisor_id?: string;
  include_downline?: boolean;
}

export interface ReportResult {
  data: Record<string, unknown>[];
  summary?: Record<string, number>;
  groupedData?: GroupedReportData[];
  total: number;
}

export interface GroupedReportData {
  groupKey: string;
  groupValue: unknown;
  records: Record<string, unknown>[];
  aggregates: Record<string, number>;
}

export interface ScheduledReport {
  id: string;
  report_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week?: number;
  day_of_month?: number;
  time_of_day: string;
  recipients: string[];
  last_sent_at?: string;
  next_send_at?: string;
  is_active: boolean;
}
