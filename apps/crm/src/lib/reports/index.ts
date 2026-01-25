// Reports Library - Template definitions and utilities

export type TemplateCategory = 'sales' | 'marketing' | 'operations' | 'financial' | 'custom';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  metrics: string[];
  filters: string[];
  defaultTimeRange: string;
  isFavorite?: boolean;
}

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { label: string; icon: string; color: string }> = {
  sales: {
    label: 'Sales & Pipeline',
    icon: 'TrendingUp',
    color: 'teal',
  },
  marketing: {
    label: 'Marketing & Leads',
    icon: 'Target',
    color: 'violet',
  },
  operations: {
    label: 'Operations',
    icon: 'Settings',
    color: 'amber',
  },
  financial: {
    label: 'Financial',
    icon: 'DollarSign',
    color: 'emerald',
  },
  custom: {
    label: 'Custom Reports',
    icon: 'FileText',
    color: 'slate',
  },
};

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
  },
  {
    id: 'task-completion',
    name: 'Task Completion',
    description: 'Team productivity and task metrics',
    category: 'operations',
    icon: 'CheckSquare',
    metrics: ['Tasks Completed', 'Overdue Tasks', 'Avg Completion Time'],
    filters: ['Date Range', 'Assignee', 'Priority'],
    defaultTimeRange: '7d',
  },
  // Financial Templates
  {
    id: 'revenue-analysis',
    name: 'Revenue Analysis',
    description: 'Comprehensive revenue breakdown and trends',
    category: 'financial',
    icon: 'DollarSign',
    metrics: ['Total Revenue', 'MRR', 'ARR', 'Growth Rate'],
    filters: ['Date Range', 'Product', 'Region'],
    defaultTimeRange: '30d',
  },
  {
    id: 'commission-report',
    name: 'Commission Report',
    description: 'Agent commissions and payouts',
    category: 'financial',
    icon: 'Wallet',
    metrics: ['Total Commissions', 'By Agent', 'By Product'],
    filters: ['Date Range', 'Agent', 'Product'],
    defaultTimeRange: '30d',
  },
];

export function getTemplatesByCategory(category?: TemplateCategory): ReportTemplate[] {
  if (!category) return REPORT_TEMPLATES;
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
