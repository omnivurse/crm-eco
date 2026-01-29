// Reports Library - Template definitions and utilities

export type TemplateCategory = 'all' | 'sales' | 'marketing' | 'team' | 'operations' | 'finance' | 'productivity';

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
    columns: ['id', 'name', 'data', 'stage_id', 'owner_id', 'created_at', 'updated_at'],
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
    columns: ['id', 'name', 'data', 'stage_id', 'owner_id', 'created_at'],
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
    columns: ['id', 'name', 'data', 'stage_id', 'owner_id', 'created_at'],
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
    columns: ['id', 'name', 'data', 'stage_id', 'created_at', 'updated_at'],
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
    columns: ['id', 'name', 'data', 'owner_id', 'created_at'],
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
    columns: ['id', 'name', 'data', 'created_at'],
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
    columns: ['id', 'name', 'data', 'stage_id', 'created_at'],
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
    columns: ['id', 'name', 'data', 'owner_id', 'created_at'],
    sorting: [{ column: 'created_at', direction: 'desc' }],
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

export function exportData(options: ExportOptions): Blob {
  const { format, data, columns } = options;

  switch (format) {
    case 'csv': {
      const headers = columns || Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
      ].join('\n');
      return new Blob([csvContent], { type: 'text/csv' });
    }
    case 'json': {
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    }
    default:
      throw new Error(`Export format ${format} not yet implemented`);
  }
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
