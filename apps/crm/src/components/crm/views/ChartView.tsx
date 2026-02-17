'use client';

import { useState, useMemo, memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  BarChart3,
  PieChartIcon,
  TrendingUp,
  Inbox,
} from 'lucide-react';
import type { CrmRecord, CrmField } from '@/lib/crm/types';

type ChartType = 'bar' | 'pie' | 'line';

interface ChartViewProps {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
}

const CHART_COLORS = [
  '#14B8A6', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#10B981', '#F97316', '#6366F1',
  '#84CC16', '#A855F7',
];

const CHART_TYPE_OPTIONS: { value: ChartType; icon: typeof BarChart3; label: string }[] = [
  { value: 'bar', icon: BarChart3, label: 'Bar Chart' },
  { value: 'pie', icon: PieChartIcon, label: 'Pie Chart' },
  { value: 'line', icon: TrendingUp, label: 'Line Chart' },
];

type Metric = 'count' | 'sum' | 'average';

function getAnalyzableFields(fields: CrmField[]): CrmField[] {
  return fields.filter(f =>
    f.type === 'select' || f.type === 'date' || f.type === 'datetime' ||
    f.key === 'status' || f.key === 'lead_status' || f.key === 'contact_status'
  );
}

function getCurrencyFields(fields: CrmField[]): CrmField[] {
  return fields.filter(f => f.type === 'currency' || f.type === 'number');
}

function getFieldValue(record: CrmRecord, fieldKey: string): string {
  if (fieldKey === 'status' || fieldKey === 'lead_status' || fieldKey === 'contact_status') {
    const val = record.status ?? record.data?.[fieldKey] ?? record.data?.status;
    return val ? String(val) : 'Unknown';
  }
  if (fieldKey === 'owner_id') {
    return record.owner_id ? 'Assigned' : 'Unassigned';
  }
  if (fieldKey === 'created_at') {
    return formatDateBucket(record.created_at);
  }
  if (fieldKey === 'updated_at') {
    return formatDateBucket(record.updated_at);
  }
  const val = record.data?.[fieldKey];
  if (!val) return 'Unknown';
  if (fieldKey.includes('date') || fieldKey.includes('_at')) {
    return formatDateBucket(String(val));
  }
  return String(val);
}

function formatDateBucket(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${year}`;
}

function getNumericValue(record: CrmRecord, fieldKey: string): number {
  if (fieldKey === 'count') return 1;
  const val = record.data?.[fieldKey];
  return Number(val) || 0;
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm text-slate-600 dark:text-slate-300">
          {entry.name}: <span className="font-semibold">{entry.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

// Individual chart card
const ChartCard = memo(function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-6',
      className
    )}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
});

export const ChartView = memo(function ChartView({
  records,
  fields,
  moduleKey,
}: ChartViewProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [xAxisField, setXAxisField] = useState<string>('status');
  const [metric, setMetric] = useState<Metric>('count');
  const [metricField, setMetricField] = useState<string>('count');

  const analyzableFields = useMemo(() => {
    const custom = getAnalyzableFields(fields);
    const system: { key: string; label: string }[] = [
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created Date' },
      { key: 'updated_at', label: 'Updated Date' },
      { key: 'owner_id', label: 'Owner' },
    ];
    const existingKeys = new Set(custom.map(f => f.key));
    return [
      ...system.filter(s => !existingKeys.has(s.key)).map(s => ({ ...s, type: 'select' as const })),
      ...custom.map(f => ({ key: f.key, label: f.label, type: f.type })),
    ];
  }, [fields]);

  const currencyFields = useMemo(() => getCurrencyFields(fields), [fields]);

  // Build primary chart data
  const primaryChartData = useMemo(() => {
    const groups: Record<string, { count: number; sum: number }> = {};

    records.forEach(record => {
      const group = getFieldValue(record, xAxisField);
      if (!groups[group]) groups[group] = { count: 0, sum: 0 };
      groups[group].count += 1;
      if (metricField !== 'count') {
        groups[group].sum += getNumericValue(record, metricField);
      }
    });

    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        value: metric === 'count' ? data.count
          : metric === 'sum' ? data.sum
          : data.count > 0 ? Math.round(data.sum / data.count) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [records, xAxisField, metric, metricField]);

  // Status distribution data (always shown)
  const statusDistribution = useMemo(() => {
    const groups: Record<string, number> = {};
    records.forEach(record => {
      const status = record.status ?? record.data?.status ?? record.data?.lead_status ?? 'Unknown';
      const key = status ? String(status) : 'Unknown';
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  // Records over time (always shown)
  const recordsOverTime = useMemo(() => {
    const groups: Record<string, number> = {};
    records.forEach(record => {
      const bucket = formatDateBucket(record.created_at);
      groups[bucket] = (groups[bucket] || 0) + 1;
    });

    // Sort chronologically
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const dateA = new Date(a.name);
        const dateB = new Date(b.name);
        return dateA.getTime() - dateB.getTime();
      });
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-4">
          <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No data to visualize</p>
        <p className="text-sm text-slate-500">Add records to see charts and analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Chart Type Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/50 dark:bg-slate-800/50 p-0.5">
            {CHART_TYPE_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                title={label}
                onClick={() => setChartType(value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all duration-200',
                  chartType === value
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-white/10 hidden sm:block" />

          {/* X-Axis Field */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Group by</span>
            <Select value={xAxisField} onValueChange={setXAxisField}>
              <SelectTrigger className="h-8 w-[140px] text-xs rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {analyzableFields.map(f => (
                  <SelectItem key={f.key} value={f.key} className="text-sm">{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Metric */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Metric</span>
            <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <SelectTrigger className="h-8 w-[110px] text-xs rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count" className="text-sm">Count</SelectItem>
                {currencyFields.length > 0 && (
                  <>
                    <SelectItem value="sum" className="text-sm">Sum</SelectItem>
                    <SelectItem value="average" className="text-sm">Average</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {metric !== 'count' && currencyFields.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Field</span>
              <Select value={metricField} onValueChange={setMetricField}>
                <SelectTrigger className="h-8 w-[140px] text-xs rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyFields.map(f => (
                    <SelectItem key={f.key} value={f.key} className="text-sm">{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Primary Custom Chart */}
        <ChartCard
          title={`${analyzableFields.find(f => f.key === xAxisField)?.label || xAxisField} Distribution`}
          description={`${metric === 'count' ? 'Record count' : metric === 'sum' ? 'Total value' : 'Average value'} by ${xAxisField}`}
          className="lg:col-span-2"
        >
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={primaryChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name={metric === 'count' ? 'Count' : 'Value'} radius={[6, 6, 0, 0]}>
                    {primaryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={primaryChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={metric === 'count' ? 'Count' : 'Value'}
                    stroke="#14B8A6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#14B8A6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              ) : (
                <PieChart>
                  <Pie
                    data={primaryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    outerRadius={130}
                    dataKey="value"
                  >
                    {primaryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Status Distribution (Pie) */}
        <ChartCard
          title="Status Breakdown"
          description="Distribution of records by status"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {statusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span className="text-xs text-slate-600 dark:text-slate-400">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Records Over Time (Line) */}
        <ChartCard
          title="Records Over Time"
          description="New records created per month"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recordsOverTime} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Records"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3B82F6' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{records.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Records</p>
        </div>
        <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{statusDistribution.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Unique Statuses</p>
        </div>
        <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {records.filter(r => r.owner_id).length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Assigned</p>
        </div>
        <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {records.filter(r => {
              const d = new Date(r.created_at);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This Month</p>
        </div>
      </div>
    </div>
  );
});
