// Reports Library - Template definitions and utilities

export type TemplateCategory = 'all' | 'sales' | 'marketing' | 'team' | 'operations' | 'finance' | 'productivity' | 'advisors' | 'healthcare';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: Exclude<TemplateCategory, 'all'>;
  icon: string;
  metrics?: string[];
  filters: string[];
  defaultTimeRange?: string;
  isFavorite?: boolean;
  // Fields for report execution
  dataSource?: string;
  columns?: string[];
  grouping?: Array<{ column: string; aggregation?: string }>;
  aggregations?: Array<{ column: string; function: string; alias?: string }>;
  sorting?: Array<{ column: string; direction: 'asc' | 'desc' }>;
}

export const TEMPLATE_CATEGORIES = [
  { id: 'all' as const, label: 'All Reports', icon: 'LayoutGrid', color: 'slate' },
  { id: 'sales' as const, label: 'Sales', icon: 'DollarSign', color: 'emerald' },
  { id: 'marketing' as const, label: 'Marketing', icon: 'Target', color: 'violet' },
  { id: 'team' as const, label: 'Team', icon: 'Users', color: 'blue' },
  { id: 'operations' as const, label: 'Operations', icon: 'Settings', color: 'amber' },
  { id: 'finance' as const, label: 'Finance', icon: 'Wallet', color: 'green' },
  { id: 'productivity' as const, label: 'Productivity', icon: 'Zap', color: 'orange' },
  { id: 'advisors' as const, label: 'Advisors', icon: 'UserCheck', color: 'cyan' },
  { id: 'healthcare' as const, label: 'Healthcare', icon: 'Heart', color: 'rose' },
];

export const REPORT_TEMPLATES: ReportTemplate[] = [
  // Sales Templates
  {
    id: 'sales-pipeline',
    name: 'Sales Pipeline Overview',
    description: 'Track deals across all pipeline stages with conversion rates',
    category: 'sales',
    icon: 'TrendingUp',
    metrics: ['Total Deals', 'Pipeline Value', 'Conversion Rate', 'Avg Deal Size'],
    filters: ['Date Range', 'Sales Rep', 'Deal Stage', 'Product'],
    defaultTimeRange: '30d',
    dataSource: 'deals',
    columns: ['id', 'title', 'data', 'stage', 'owner_id', 'created_at', 'updated_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  {
    id: 'sales-forecast',
    name: 'Sales Forecast',
    description: 'Projected revenue based on deal probability and close dates',
    category: 'sales',
    icon: 'BarChart3',
    metrics: ['Projected Revenue', 'Weighted Pipeline', 'Expected Close'],
    filters: ['Date Range', 'Sales Rep', 'Region'],
    defaultTimeRange: '90d',
    dataSource: 'deals',
    columns: ['id', 'title', 'data', 'stage', 'owner_id', 'created_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  {
    id: 'sales-performance',
    name: 'Sales Rep Performance',
    description: 'Individual and team performance metrics',
    category: 'sales',
    icon: 'Users',
    metrics: ['Deals Closed', 'Revenue', 'Win Rate', 'Quota Attainment'],
    filters: ['Date Range', 'Sales Rep', 'Team'],
    defaultTimeRange: '30d',
    dataSource: 'deals',
    columns: ['id', 'title', 'data', 'stage', 'owner_id', 'created_at'],
    sorting: [{ column: 'owner_id', direction: 'asc' }],
  },
  {
    id: 'deal-velocity',
    name: 'Deal Velocity',
    description: 'Average time to close deals by stage and type',
    category: 'sales',
    icon: 'Zap',
    metrics: ['Avg Days to Close', 'Stage Duration', 'Bottlenecks'],
    filters: ['Date Range', 'Deal Type', 'Product'],
    defaultTimeRange: '90d',
    dataSource: 'deals',
    columns: ['id', 'title', 'data', 'stage', 'created_at', 'updated_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  // Marketing Templates
  {
    id: 'lead-generation',
    name: 'Lead Generation',
    description: 'Track lead sources and conversion rates',
    category: 'marketing',
    icon: 'Target',
    metrics: ['New Leads', 'Source Performance', 'Lead Quality Score'],
    filters: ['Date Range', 'Lead Source', 'Campaign'],
    defaultTimeRange: '30d',
    dataSource: 'leads',
    columns: ['id', 'title', 'data', 'owner_id', 'created_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  {
    id: 'campaign-performance',
    name: 'Campaign Performance',
    description: 'Analyze marketing campaign effectiveness',
    category: 'marketing',
    icon: 'BarChart3',
    metrics: ['Impressions', 'Clicks', 'Conversions', 'ROI'],
    filters: ['Date Range', 'Campaign', 'Channel'],
    defaultTimeRange: '30d',
    dataSource: 'leads',
    columns: ['id', 'title', 'data', 'created_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  // Team Templates
  {
    id: 'team-performance',
    name: 'Team Performance',
    description: 'Track team productivity and achievements',
    category: 'team',
    icon: 'Users',
    metrics: ['Tasks Completed', 'Goals Met', 'Response Time'],
    filters: ['Date Range', 'Team Member', 'Department'],
    defaultTimeRange: '30d',
    dataSource: 'tasks',
    columns: ['id', 'title', 'status', 'priority', 'assigned_to', 'due_at', 'completed_at', 'created_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  // Operations Templates
  {
    id: 'enrollment-status',
    name: 'Enrollment Status',
    description: 'Track member enrollments and status changes',
    category: 'operations',
    icon: 'Users',
    metrics: ['New Enrollments', 'Active Members', 'Churn Rate'],
    filters: ['Date Range', 'Product', 'Agent'],
    defaultTimeRange: '30d',
    dataSource: 'enrollments',
    columns: ['*'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  {
    id: 'task-completion',
    name: 'Task Completion',
    description: 'Task tracking and completion metrics',
    category: 'operations',
    icon: 'CheckSquare',
    metrics: ['Tasks Completed', 'Overdue Tasks', 'Avg Completion Time'],
    filters: ['Date Range', 'Assignee', 'Priority'],
    defaultTimeRange: '7d',
    dataSource: 'tasks',
    columns: ['id', 'title', 'status', 'priority', 'assigned_to', 'due_at', 'completed_at', 'created_at'],
    sorting: [{ column: 'due_at', direction: 'asc' }],
  },
  // Finance Templates
  {
    id: 'revenue-analysis',
    name: 'Revenue Analysis',
    description: 'Comprehensive revenue breakdown and trends',
    category: 'finance',
    icon: 'DollarSign',
    metrics: ['Total Revenue', 'MRR', 'ARR', 'Growth Rate'],
    filters: ['Date Range', 'Product', 'Region'],
    defaultTimeRange: '30d',
    dataSource: 'deals',
    columns: ['id', 'title', 'data', 'stage', 'created_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  {
    id: 'commission-report',
    name: 'Commission Report',
    description: 'Agent commissions and payouts',
    category: 'finance',
    icon: 'Wallet',
    metrics: ['Total Commissions', 'By Agent', 'By Product'],
    filters: ['Date Range', 'Agent', 'Product'],
    defaultTimeRange: '30d',
    dataSource: 'commissions',
    columns: ['*'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  // Productivity Templates
  {
    id: 'productivity-overview',
    name: 'Productivity Overview',
    description: 'Overall productivity metrics and trends',
    category: 'productivity',
    icon: 'Zap',
    metrics: ['Output', 'Efficiency', 'Time Savings'],
    filters: ['Date Range', 'Team', 'Process'],
    defaultTimeRange: '30d',
    dataSource: 'tasks',
    columns: ['id', 'title', 'status', 'priority', 'assigned_to', 'due_at', 'completed_at', 'created_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  // Contact Templates
  {
    id: 'contact-list',
    name: 'Contact List',
    description: 'All contacts with key information',
    category: 'sales',
    icon: 'Users',
    metrics: ['Total Contacts', 'New This Month', 'Active Contacts'],
    filters: ['Date Range', 'Owner', 'Status'],
    defaultTimeRange: '30d',
    dataSource: 'contacts',
    columns: ['id', 'title', 'data', 'owner_id', 'created_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
  },
  // Advisor Templates
  {
    id: 'advisor-enrollments',
    name: 'Advisor Enrollment Report',
    description: 'Enrollments by advisor with status breakdown and date range filtering',
    category: 'advisors',
    icon: 'UserCheck',
    metrics: ['Total Enrollments', 'By Status', 'By Advisor'],
    filters: ['Date Range', 'Advisor', 'State', 'Status'],
    defaultTimeRange: '30d',
    dataSource: 'enrollments',
    columns: ['advisor_name', 'total_enrollments', 'active', 'pending', 'cancelled', 'terminated'],
    grouping: [{ column: 'advisor_id', aggregation: 'count' }],
    sorting: [{ column: 'total_enrollments', direction: 'desc' }],
  },
  {
    id: 'advisor-active-members',
    name: 'Advisor Active Members',
    description: 'Active members per advisor with plan and status details',
    category: 'advisors',
    icon: 'Users',
    metrics: ['Active Members', 'By Plan', 'By Advisor'],
    filters: ['Advisor', 'State', 'Plan'],
    dataSource: 'members',
    columns: ['advisor_name', 'active_members', 'states', 'plan_breakdown'],
    grouping: [{ column: 'advisor_id', aggregation: 'count' }],
    sorting: [{ column: 'active_members', direction: 'desc' }],
  },
  {
    id: 'advisor-cancellations',
    name: 'Advisor Cancellations',
    description: 'Terminated and cancelled members by advisor with cancellation rates',
    category: 'advisors',
    icon: 'UserMinus',
    metrics: ['Cancellations', 'Cancellation Rate', 'By Advisor'],
    filters: ['Date Range', 'Advisor', 'State'],
    defaultTimeRange: '90d',
    dataSource: 'members',
    columns: ['advisor_name', 'total_members', 'cancelled_count', 'terminated_count', 'cancellation_rate'],
    grouping: [{ column: 'advisor_id', aggregation: 'count' }],
    sorting: [{ column: 'cancellation_rate', direction: 'desc' }],
  },
  {
    id: 'advisor-revenue',
    name: 'Advisor Revenue',
    description: 'Commission revenue per advisor broken down by commission type',
    category: 'advisors',
    icon: 'DollarSign',
    metrics: ['Gross Revenue', 'Net Revenue', 'By Commission Type'],
    filters: ['Date Range', 'Advisor'],
    defaultTimeRange: '30d',
    dataSource: 'commissions',
    columns: ['advisor_name', 'signup_commissions', 'monthly_commissions', 'override_commissions', 'bonus_commissions', 'gross_commissions', 'net_commissions'],
    grouping: [{ column: 'advisor_id', aggregation: 'sum' }],
    sorting: [{ column: 'gross_commissions', direction: 'desc' }],
  },
  // Healthcare Templates
  {
    id: 'network-coverage-report',
    name: 'Network Coverage Report',
    description: 'Provider network coverage by ZIP code and state with coverage grades',
    category: 'healthcare',
    icon: 'Shield',
    metrics: ['Coverage Score', 'Provider Count', 'Preferred Providers', 'Coverage Grade'],
    filters: ['Network', 'State', 'ZIP Code'],
    dataSource: 'network_coverage_zips',
    columns: ['network_name', 'zip_code', 'state', 'provider_count', 'preferred_count', 'coverage_score', 'coverage_grade'],
    sorting: [{ column: 'coverage_score', direction: 'desc' }],
  },
  {
    id: 'network-provider-search-report',
    name: 'Network Provider Search',
    description: 'In-network provider search results with distance and tier information',
    category: 'healthcare',
    icon: 'Search',
    metrics: ['Total Providers', 'Avg Distance', 'Preferred Count'],
    filters: ['Network', 'ZIP Code', 'Service Category', 'Radius'],
    dataSource: 'network_providers',
    columns: ['provider_name', 'provider_type', 'city', 'state', 'network_tier', 'distance_miles', 'specialty_tags'],
    sorting: [{ column: 'distance_miles', direction: 'asc' }],
  },
];

export function getTemplatesByCategory(category?: TemplateCategory): ReportTemplate[] {
  if (!category || category === 'all') return REPORT_TEMPLATES;
  return REPORT_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplateById(id: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id);
}

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf' | 'json';
  filename?: string;
  data: Record<string, unknown>[];
  columns?: string[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toSpreadsheetMl(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join('');
  const rows = data
    .map((row) => {
      const cells = headers
        .map((h) => {
          const raw = row[h];
          const value = raw == null ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
          return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Report"><Table><Row>${headerRow}</Row>${rows}</Table></Worksheet>
</Workbook>`;
}

export function exportData(options: ExportOptions): Blob {
  const { format, data, columns } = options;
  const headers = columns || Object.keys(data[0] || {});

  switch (format) {
    case 'csv': {
      const csvContent = [
        headers.join(','),
        ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
      ].join('\n');
      return new Blob([csvContent], { type: 'text/csv' });
    }
    case 'json': {
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    }
    case 'xlsx': {
      return new Blob([toSpreadsheetMl(data, headers)], {
        type: 'application/vnd.ms-excel',
      });
    }
    default:
      throw new Error(`Export format ${format} not yet implemented`);
  }
}

export function downloadReportRows(
  data: Record<string, unknown>[],
  filename: string,
  format: 'csv' | 'xlsx' | 'json' = 'csv',
): void {
  if (data.length === 0) return;
  const blob = exportData({ format, data, filename });
  const ext = format === 'xlsx' ? 'xls' : format;
  downloadExport(blob, `${filename}.${ext}`);
}

export function downloadExport(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
