'use client';

import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
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
  LineChart,
  PieChart,
  AreaChart,
  Table2,
  TrendingDown,
  Layers,
  Eye,
} from 'lucide-react';
import { CHART_TYPES, REPORT_TYPES, type FieldOption, type ModuleOption } from '../useReportBuilder';
import type {
  ChartType,
  ChartConfig,
  ReportType,
  ReportColumn,
  ReportFilter,
  ReportGrouping,
  ReportAggregation,
  RelatedModuleConfig,
} from '@/lib/reports/types';

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  none: <Table2 className="w-5 h-5" />,
  bar: <BarChart3 className="w-5 h-5" />,
  line: <LineChart className="w-5 h-5" />,
  pie: <PieChart className="w-5 h-5" />,
  area: <AreaChart className="w-5 h-5" />,
  funnel: <TrendingDown className="w-5 h-5" />,
  stacked_bar: <Layers className="w-5 h-5" />,
};

interface StepVisualizeProps {
  reportName: string;
  reportType: ReportType;
  primaryModule?: ModuleOption;
  relatedModules: RelatedModuleConfig[];
  columns: ReportColumn[];
  filters: ReportFilter[];
  grouping: ReportGrouping[];
  aggregations: ReportAggregation[];
  chartType: ChartType;
  chartConfig: ChartConfig;
  isShared: boolean;
  allFields: FieldOption[];
  onChartTypeChange: (type: ChartType) => void;
  onChartConfigChange: (config: ChartConfig) => void;
  onSharedChange: (shared: boolean) => void;
  onNameChange: (name: string) => void;
}

export function StepVisualize({
  reportName,
  reportType,
  primaryModule,
  relatedModules,
  columns,
  filters,
  grouping,
  aggregations,
  chartType,
  chartConfig,
  isShared,
  allFields,
  onChartTypeChange,
  onChartConfigChange,
  onSharedChange,
  onNameChange,
}: StepVisualizeProps) {
  return (
    <div className="space-y-8">
      {/* Chart Type Grid */}
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
          Visualization
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {CHART_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => onChartTypeChange(type.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all',
                chartType === type.value
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-500/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <div className={cn(
                'p-2 rounded-lg',
                chartType === type.value
                  ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}>
                {CHART_ICONS[type.value]}
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center">
                {type.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart Config (if chart selected) */}
      {chartType !== 'none' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <div className="space-y-1.5">
            <Label className="text-xs">X-Axis Field</Label>
            <Select
              value={chartConfig.xAxis || ''}
              onValueChange={(v) => onChartConfigChange({ ...chartConfig, xAxis: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {allFields.map((f) => (
                  <SelectItem key={`${f.module_key}.${f.key}`} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Y-Axis Field</Label>
            <Select
              value={chartConfig.yAxis || ''}
              onValueChange={(v) => onChartConfigChange({ ...chartConfig, yAxis: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {allFields.map((f) => (
                  <SelectItem key={`${f.module_key}.${f.key}`} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-legend"
                checked={chartConfig.showLegend ?? true}
                onCheckedChange={(c) => onChartConfigChange({ ...chartConfig, showLegend: c as boolean })}
              />
              <Label htmlFor="show-legend" className="text-xs">Show Legend</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-labels"
                checked={chartConfig.showLabels ?? true}
                onCheckedChange={(c) => onChartConfigChange({ ...chartConfig, showLabels: c as boolean })}
              />
              <Label htmlFor="show-labels" className="text-xs">Show Labels</Label>
            </div>
          </div>
        </div>
      )}

      {/* Sharing */}
      <div className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <Checkbox
          id="shared"
          checked={isShared}
          onCheckedChange={(c) => onSharedChange(c as boolean)}
        />
        <Label htmlFor="shared" className="text-sm">
          Share this report with all team members
        </Label>
      </div>

      {/* Report Name (final confirmation) */}
      <div className="space-y-1.5">
        <Label htmlFor="final-name" className="text-sm">Report Name *</Label>
        <Input
          id="final-name"
          value={reportName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Give your report a name"
          className="max-w-md"
        />
      </div>

      {/* Report Summary */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl p-5 space-y-3 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-violet-500" />
          <h4 className="font-semibold text-slate-900 dark:text-white">
            Report Summary
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryItem label="Name" value={reportName || 'Untitled'} />
          <SummaryItem label="Type" value={REPORT_TYPES.find(t => t.value === reportType)?.label || reportType} />
          <SummaryItem label="Primary Module" value={primaryModule?.name || 'Not selected'} />
          <SummaryItem
            label="Related Modules"
            value={relatedModules.length > 0 ? relatedModules.map(rm => rm.module_name).join(', ') : 'None'}
          />
          <SummaryItem label="Columns" value={`${columns.length} selected`} />
          <SummaryItem label="Filters" value={`${filters.length} condition${filters.length !== 1 ? 's' : ''}`} />
          <SummaryItem label="Grouping" value={grouping.length > 0 ? `${grouping.length} level${grouping.length !== 1 ? 's' : ''}` : 'None'} />
          <SummaryItem label="Aggregations" value={aggregations.length > 0 ? `${aggregations.length}` : 'None'} />
          <SummaryItem
            label="Visualization"
            value={chartType !== 'none' ? CHART_TYPES.find(t => t.value === chartType)?.label || chartType : 'Table only'}
          />
          <SummaryItem label="Shared" value={isShared ? 'Yes' : 'No'} />
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}
