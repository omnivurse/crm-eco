import type { SavedReport, DataSource } from './types.js';

// ============================================================================
// REPORT TEMPLATE INTERFACE
// ============================================================================

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  dataSource: DataSource;
  columns: string[];
  filters: SavedReport['filters'];
  grouping: SavedReport['grouping'];
  aggregations: SavedReport['aggregations'];
  sorting: SavedReport['sorting'];
  icon?: string;
}

// ============================================================================
// TEMPLATE CATEGORIES
// ============================================================================

export const TEMPLATE_CATEGORIES = [
  { id: 'members', label: 'Member Reports', icon: 'Users' },
  { id: 'advisors', label: 'Advisor Reports', icon: 'UserCheck' },
  { id: 'enrollments', label: 'Enrollment Reports', icon: 'FileText' },
  { id: 'commissions', label: 'Commission Reports', icon: 'DollarSign' },
  { id: 'performance', label: 'Performance Reports', icon: 'TrendingUp' },
  { id: 'geographic', label: 'Geographic Reports', icon: 'Map' },
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number]['id'];

// ============================================================================
// REPORT TEMPLATES
// ============================================================================

export const REPORT_TEMPLATES: ReportTemplate[] = [
  // =========================================================================
  // MEMBER REPORTS
  // =========================================================================
  {
    id: 'members-by-state',
    name: 'Members by State',
    description: 'Geographic distribution of all members grouped by state',
    category: 'members',
    dataSource: 'members',
    columns: ['state'],
    filters: [],
    grouping: [{ column: 'state', label: 'State' }],
    aggregations: [
      { column: 'id', type: 'count', alias: 'member_count' },
    ],
    sorting: [{ column: 'state', direction: 'asc' }],
    icon: 'MapPin',
  },
  {
    id: 'members-by-status',
    name: 'Members by Status',
    description: 'Breakdown of members by their current status',
    category: 'members',
    dataSource: 'members',
    columns: ['status'],
    filters: [],
    grouping: [{ column: 'status', label: 'Status' }],
    aggregations: [
      { column: 'id', type: 'count', alias: 'count' },
    ],
    sorting: [{ column: 'status', direction: 'asc' }],
    icon: 'Activity',
  },
  {
    id: 'members-active',
    name: 'Active Members List',
    description: 'All active members with their advisor information',
    category: 'members',
    dataSource: 'members',
    columns: [
      'member_number',
      'first_name',
      'last_name',
      'email',
      'state',
      'enrollment_date',
      'advisor.first_name',
      'advisor.last_name',
    ],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
    ],
    grouping: [],
    aggregations: [],
    sorting: [{ column: 'last_name', direction: 'asc' }],
    icon: 'UserCheck',
  },
  {
    id: 'members-in-date-range',
    name: 'New Members (Date Range)',
    description: 'Members enrolled within a specific date range',
    category: 'members',
    dataSource: 'members',
    columns: [
      'member_number',
      'first_name',
      'last_name',
      'email',
      'state',
      'enrollment_date',
      'effective_date',
      'advisor.first_name',
      'advisor.last_name',
    ],
    filters: [
      // Date filters should be added dynamically by the UI
    ],
    grouping: [],
    aggregations: [],
    sorting: [{ column: 'enrollment_date', direction: 'desc' }],
    icon: 'Calendar',
  },
  {
    id: 'member-retention',
    name: 'Retention Analysis',
    description: 'Member retention by enrollment month with termination counts',
    category: 'members',
    dataSource: 'members',
    columns: ['enrollment_date', 'status'],
    filters: [],
    grouping: [
      { column: 'enrollment_date', label: 'Enrollment Month' },
      { column: 'status', label: 'Status' },
    ],
    aggregations: [
      { column: 'id', type: 'count', alias: 'count' },
    ],
    sorting: [{ column: 'enrollment_date', direction: 'desc' }],
    icon: 'RefreshCw',
  },

  // =========================================================================
  // ADVISOR REPORTS
  // =========================================================================
  {
    id: 'advisors-by-level',
    name: 'Advisors by Level',
    description: 'Distribution of advisors across agent levels',
    category: 'advisors',
    dataSource: 'advisors',
    columns: ['level.name'],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
    ],
    grouping: [{ column: 'level.name', label: 'Level' }],
    aggregations: [
      { column: 'id', type: 'count', alias: 'advisor_count' },
    ],
    sorting: [{ column: 'level.name', direction: 'asc' }],
    icon: 'Award',
  },
  {
    id: 'top-advisors',
    name: 'Top Performing Advisors',
    description: 'Advisors ranked by active member count',
    category: 'advisors',
    dataSource: 'advisors',
    columns: [
      'code',
      'first_name',
      'last_name',
      'email',
      'state',
      'level.name',
    ],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
    ],
    grouping: [],
    aggregations: [],
    sorting: [{ column: 'created_at', direction: 'desc' }],
    icon: 'Trophy',
  },
  {
    id: 'advisors-by-state',
    name: 'Advisors by State',
    description: 'Geographic distribution of advisors',
    category: 'advisors',
    dataSource: 'advisors',
    columns: ['state'],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
    ],
    grouping: [{ column: 'state', label: 'State' }],
    aggregations: [
      { column: 'id', type: 'count', alias: 'count' },
    ],
    sorting: [{ column: 'state', direction: 'asc' }],
    icon: 'Map',
  },
  {
    id: 'advisor-hierarchy',
    name: 'Advisor Hierarchy',
    description: 'Advisors with their upline information',
    category: 'advisors',
    dataSource: 'advisors',
    columns: [
      'code',
      'first_name',
      'last_name',
      'level.name',
      'parent.first_name',
      'parent.last_name',
    ],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
    ],
    grouping: [],
    aggregations: [],
    sorting: [{ column: 'level.name', direction: 'asc' }],
    icon: 'GitBranch',
  },

  // =========================================================================
  // ENROLLMENT REPORTS
  // =========================================================================
  {
    id: 'enrollments-per-advisor',
    name: 'Enrollments per Advisor',
    description: 'Count of enrollments grouped by advisor',
    category: 'enrollments',
    dataSource: 'enrollments',
    columns: ['advisor.first_name', 'advisor.last_name'],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
    ],
    grouping: [
      { column: 'advisor.first_name', label: 'Advisor First Name' },
      { column: 'advisor.last_name', label: 'Advisor Last Name' },
    ],
    aggregations: [
      { column: 'id', type: 'count', alias: 'enrollment_count' },
      { column: 'monthly_premium', type: 'sum', alias: 'total_premium' },
    ],
    sorting: [{ column: 'advisor.last_name', direction: 'asc' }],
    icon: 'BarChart',
  },
  {
    id: 'enrollments-by-product',
    name: 'Enrollments by Product',
    description: 'Product popularity based on enrollment counts',
    category: 'enrollments',
    dataSource: 'enrollments',
    columns: ['product.name', 'product.type'],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
    ],
    grouping: [
      { column: 'product.name', label: 'Product' },
      { column: 'product.type', label: 'Type' },
    ],
    aggregations: [
      { column: 'id', type: 'count', alias: 'count' },
      { column: 'monthly_premium', type: 'sum', alias: 'total_premium' },
    ],
    sorting: [{ column: 'product.name', direction: 'asc' }],
    icon: 'Package',
  },
  {
    id: 'members-with-addons',
    name: 'Members with Add-Ons',
    description: 'Enrollments for add-on products (Dental/Vision)',
    category: 'enrollments',
    dataSource: 'enrollments',
    columns: [
      'member.first_name',
      'member.last_name',
      'product.name',
      'product.type',
      'monthly_premium',
      'enrollment_date',
    ],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
      { column: 'product.is_addon', operator: 'eq', value: true },
    ],
    grouping: [],
    aggregations: [],
    sorting: [{ column: 'enrollment_date', direction: 'desc' }],
    icon: 'Plus',
  },
  {
    id: 'monthly-enrollments',
    name: 'Monthly Enrollment Trend',
    description: 'Enrollment counts by month',
    category: 'enrollments',
    dataSource: 'enrollments',
    columns: ['enrollment_date'],
    filters: [],
    grouping: [{ column: 'enrollment_date', label: 'Month' }],
    aggregations: [
      { column: 'id', type: 'count', alias: 'count' },
      { column: 'monthly_premium', type: 'sum', alias: 'total_premium' },
    ],
    sorting: [{ column: 'enrollment_date', direction: 'desc' }],
    icon: 'TrendingUp',
  },

  // =========================================================================
  // COMMISSION REPORTS
  // =========================================================================
  {
    id: 'commission-earnings',
    name: 'Commission Earnings',
    description: 'Total commission amounts by advisor',
    category: 'commissions',
    dataSource: 'commissions',
    columns: ['advisor.first_name', 'advisor.last_name', 'advisor.code'],
    filters: [
      { column: 'status', operator: 'eq', value: 'paid' },
    ],
    grouping: [
      { column: 'advisor.first_name', label: 'First Name' },
      { column: 'advisor.last_name', label: 'Last Name' },
      { column: 'advisor.code', label: 'Code' },
    ],
    aggregations: [
      { column: 'amount', type: 'sum', alias: 'total_earnings' },
      { column: 'id', type: 'count', alias: 'commission_count' },
    ],
    sorting: [{ column: 'advisor.last_name', direction: 'asc' }],
    icon: 'DollarSign',
  },
  {
    id: 'pending-commissions',
    name: 'Pending Commissions',
    description: 'All pending commissions awaiting approval or payment',
    category: 'commissions',
    dataSource: 'commissions',
    columns: [
      'advisor.first_name',
      'advisor.last_name',
      'advisor.code',
      'commission_period',
      'commission_type',
      'amount',
      'status',
      'created_at',
    ],
    filters: [
      { column: 'status', operator: 'in', value: ['pending', 'approved'] },
    ],
    grouping: [],
    aggregations: [],
    sorting: [{ column: 'created_at', direction: 'desc' }],
    icon: 'Clock',
  },
  {
    id: 'commissions-by-period',
    name: 'Commissions by Period',
    description: 'Commission totals grouped by period',
    category: 'commissions',
    dataSource: 'commissions',
    columns: ['commission_period'],
    filters: [],
    grouping: [{ column: 'commission_period', label: 'Period' }],
    aggregations: [
      { column: 'amount', type: 'sum', alias: 'total_amount' },
      { column: 'id', type: 'count', alias: 'count' },
    ],
    sorting: [{ column: 'commission_period', direction: 'desc' }],
    icon: 'Calendar',
  },
  {
    id: 'commissions-by-type',
    name: 'Commissions by Type',
    description: 'Commission breakdown by type (initial, renewal, override, bonus)',
    category: 'commissions',
    dataSource: 'commissions',
    columns: ['commission_type'],
    filters: [],
    grouping: [{ column: 'commission_type', label: 'Type' }],
    aggregations: [
      { column: 'amount', type: 'sum', alias: 'total_amount' },
      { column: 'id', type: 'count', alias: 'count' },
      { column: 'amount', type: 'avg', alias: 'avg_amount' },
    ],
    sorting: [{ column: 'commission_type', direction: 'asc' }],
    icon: 'PieChart',
  },

  // =========================================================================
  // GEOGRAPHIC REPORTS
  // =========================================================================
  {
    id: 'regional-cost-analysis',
    name: 'Regional Cost Analysis',
    description: 'Premium analysis by state/region',
    category: 'geographic',
    dataSource: 'enrollments',
    columns: ['member.state'],
    filters: [
      { column: 'status', operator: 'eq', value: 'active' },
    ],
    grouping: [{ column: 'member.state', label: 'State' }],
    aggregations: [
      { column: 'id', type: 'count', alias: 'enrollment_count' },
      { column: 'monthly_premium', type: 'sum', alias: 'total_premium' },
      { column: 'monthly_premium', type: 'avg', alias: 'avg_premium' },
    ],
    sorting: [{ column: 'member.state', direction: 'asc' }],
    icon: 'MapPin',
  },
  {
    id: 'state-performance',
    name: 'State Performance',
    description: 'Member and enrollment counts by state',
    category: 'geographic',
    dataSource: 'members',
    columns: ['state', 'status'],
    filters: [],
    grouping: [
      { column: 'state', label: 'State' },
      { column: 'status', label: 'Status' },
    ],
    aggregations: [
      { column: 'id', type: 'count', alias: 'count' },
    ],
    sorting: [{ column: 'state', direction: 'asc' }],
    icon: 'Globe',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTemplateById(id: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): ReportTemplate[] {
  return REPORT_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByDataSource(dataSource: DataSource): ReportTemplate[] {
  return REPORT_TEMPLATES.filter((t) => t.dataSource === dataSource);
}

export function convertTemplateToReport(
  template: ReportTemplate,
  orgId: string,
  name?: string
): SavedReport {
  return {
    orgId,
    name: name || template.name,
    description: template.description,
    dataSource: template.dataSource,
    columns: template.columns,
    filters: template.filters,
    grouping: template.grouping,
    aggregations: template.aggregations,
    sorting: template.sorting,
    isTemplate: false,
    templateCategory: template.category,
  };
}
