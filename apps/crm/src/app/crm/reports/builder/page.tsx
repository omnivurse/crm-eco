'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Play,
  Plus,
  Trash2,
  GripVertical,
  BarChart3,
  LineChart,
  PieChart,
  Table2,
  Filter,
  Loader2,
  Eye,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  CrmReport,
  ReportColumn,
  ReportFilter,
  ReportGrouping,
  ReportAggregation,
  ReportType,
  ChartType,
  AggregationFunction,
} from '@/lib/reports/types';

interface CrmModule {
  id: string;
  name: string;
  key: string;
  fields: ModuleField[];
}

interface ModuleField {
  key: string;
  label: string;
  type: string;
}

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: 'tabular', label: 'Tabular', description: 'Simple table view of records' },
  { value: 'summary', label: 'Summary', description: 'Grouped data with aggregations' },
  { value: 'matrix', label: 'Matrix', description: 'Cross-tabulation report' },
];

const CHART_TYPES: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'No Chart', icon: <Table2 className="w-4 h-4" /> },
  { value: 'bar', label: 'Bar Chart', icon: <BarChart3 className="w-4 h-4" /> },
  { value: 'line', label: 'Line Chart', icon: <LineChart className="w-4 h-4" /> },
  { value: 'pie', label: 'Pie Chart', icon: <PieChart className="w-4 h-4" /> },
];

const FILTER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
];

const AGGREGATION_FUNCTIONS: { value: AggregationFunction; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

function ReportBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<CrmModule[]>([]);

  // Report configuration
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [reportType, setReportType] = useState<ReportType>('tabular');
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [grouping, setGrouping] = useState<ReportGrouping[]>([]);
  const [aggregations, setAggregations] = useState<ReportAggregation[]>([]);
  const [chartType, setChartType] = useState<ChartType>('none');
  const [isShared, setIsShared] = useState(false);

  // Get available fields for selected module
  const selectedModuleData = modules.find(m => m.id === selectedModule);
  const availableFields = selectedModuleData?.fields || [];

  useEffect(() => {
    loadModules();
    if (reportId) {
      loadReport(reportId);
    }
  }, [reportId]);

  async function loadModules() {
    try {
      const response = await fetch('/api/crm/modules');
      const data = await response.json();
      setModules(data.modules || []);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  }

  async function loadReport(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/${id}`);
      if (response.ok) {
        const report: CrmReport = await response.json();
        setReportName(report.name);
        setReportDescription(report.description || '');
        setSelectedModule(report.module_id || '');
        setReportType(report.report_type);
        setColumns(report.columns);
        setFilters(report.filters);
        setGrouping(report.grouping);
        setAggregations(report.aggregations);
        setChartType(report.chart_type);
        setIsShared(report.is_shared);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!reportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }

    if (!selectedModule) {
      toast.error('Please select a module');
      return;
    }

    if (columns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: reportName,
        description: reportDescription,
        module_id: selectedModule,
        report_type: reportType,
        columns,
        filters,
        grouping,
        aggregations,
        chart_type: chartType,
        chart_config: {},
        is_shared: isShared,
      };

      const url = reportId ? `/api/reports/${reportId}` : '/api/reports';
      const response = await fetch(url, {
        method: reportId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save');

      const data = await response.json();
      toast.success('Report saved');
      router.push(`/crm/reports/${data.id || reportId}`);
    } catch (error) {
      toast.error('Failed to save report');
    } finally {
      setSaving(false);
    }
  }

  function addColumn(field: ModuleField) {
    if (columns.some(c => c.field === field.key)) return;

    setColumns([
      ...columns,
      {
        field: field.key,
        label: field.label,
        type: field.type as ReportColumn['type'],
        sortable: true,
      },
    ]);
  }

  function removeColumn(field: string) {
    setColumns(columns.filter(c => c.field !== field));
  }

  function addFilter() {
    if (availableFields.length === 0) return;

    setFilters([
      ...filters,
      {
        field: availableFields[0].key,
        operator: 'equals',
        value: '',
      },
    ]);
  }

  function updateFilter(index: number, updates: Partial<ReportFilter>) {
    setFilters(filters.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }

  function removeFilter(index: number) {
    setFilters(filters.filter((_, i) => i !== index));
  }

  function addGrouping() {
    if (availableFields.length === 0) return;

    setGrouping([
      ...grouping,
      {
        field: availableFields[0].key,
        order: 'asc',
      },
    ]);
  }

  function addAggregation() {
    const numericFields = availableFields.filter(f =>
      ['number', 'currency'].includes(f.type)
    );
    if (numericFields.length === 0) return;

    setAggregations([
      ...aggregations,
      {
        field: numericFields[0].key,
        function: 'sum',
      },
    ]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {reportId ? 'Edit Report' : 'Create Report'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Build a custom report to analyze your CRM data
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              step === s
                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            <span className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium',
              step === s ? 'bg-violet-500 text-white' : 'bg-slate-200 dark:bg-slate-700'
            )}>
              {s}
            </span>
            <span className="hidden sm:inline">
              {s === 1 && 'Basics'}
              {s === 2 && 'Columns'}
              {s === 3 && 'Filters'}
              {s === 4 && 'Visualization'}
            </span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Report Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Monthly Sales Summary"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this report shows..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Module *</Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Report Type</Label>
              <div className="grid grid-cols-3 gap-3">
                {REPORT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setReportType(type.value)}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      reportType === type.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    <p className="font-medium text-slate-900 dark:text-white">
                      {type.label}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {type.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Columns */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">
                Available Fields
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Click to add fields to your report
              </p>

              {availableFields.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  Select a module first to see available fields
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableFields.map((field) => (
                    <button
                      key={field.key}
                      onClick={() => addColumn(field)}
                      disabled={columns.some(c => c.field === field.key)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm transition-colors',
                        columns.some(c => c.field === field.key)
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                      )}
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">
                Selected Columns ({columns.length})
              </h3>

              {columns.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  No columns selected. Click on fields above to add them.
                </p>
              ) : (
                <div className="space-y-2">
                  {columns.map((col) => (
                    <div
                      key={col.field}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                    >
                      <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                      <span className="flex-1 text-slate-900 dark:text-white">
                        {col.label}
                      </span>
                      <span className="text-xs text-slate-500">{col.type}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => removeColumn(col.field)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Filters & Grouping */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    Filters
                  </h3>
                  <p className="text-sm text-slate-500">
                    Filter which records to include
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Filter
                </Button>
              </div>

              {filters.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  No filters applied. All records will be included.
                </p>
              ) : (
                <div className="space-y-3">
                  {filters.map((filter, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                    >
                      <Select
                        value={filter.field}
                        onValueChange={(v) => updateFilter(index, { field: v })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filter.operator}
                        onValueChange={(v) => updateFilter(index, { operator: v })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FILTER_OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {!['is_empty', 'is_not_empty'].includes(filter.operator) && (
                        <Input
                          placeholder="Value"
                          value={String(filter.value || '')}
                          onChange={(e) => updateFilter(index, { value: e.target.value })}
                          className="flex-1"
                        />
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => removeFilter(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {reportType !== 'tabular' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        Grouping
                      </h3>
                      <p className="text-sm text-slate-500">
                        Group records by field values
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addGrouping}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Grouping
                    </Button>
                  </div>

                  {grouping.length > 0 && (
                    <div className="space-y-3">
                      {grouping.map((group, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                        >
                          <Select
                            value={group.field}
                            onValueChange={(v) => {
                              const newGrouping = [...grouping];
                              newGrouping[index].field = v;
                              setGrouping(newGrouping);
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFields.map((f) => (
                                <SelectItem key={f.key} value={f.key}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={group.order}
                            onValueChange={(v: 'asc' | 'desc') => {
                              const newGrouping = [...grouping];
                              newGrouping[index].order = v;
                              setGrouping(newGrouping);
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">Ascending</SelectItem>
                              <SelectItem value="desc">Descending</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => setGrouping(grouping.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        Aggregations
                      </h3>
                      <p className="text-sm text-slate-500">
                        Calculate summary values
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addAggregation}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Aggregation
                    </Button>
                  </div>

                  {aggregations.length > 0 && (
                    <div className="space-y-3">
                      {aggregations.map((agg, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                        >
                          <Select
                            value={agg.function}
                            onValueChange={(v: AggregationFunction) => {
                              const newAgg = [...aggregations];
                              newAgg[index].function = v;
                              setAggregations(newAgg);
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AGGREGATION_FUNCTIONS.map((fn) => (
                                <SelectItem key={fn.value} value={fn.value}>
                                  {fn.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <span className="text-slate-500">of</span>

                          <Select
                            value={agg.field}
                            onValueChange={(v) => {
                              const newAgg = [...aggregations];
                              newAgg[index].field = v;
                              setAggregations(newAgg);
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFields
                                .filter(f => ['number', 'currency'].includes(f.type) || agg.function === 'count')
                                .map((f) => (
                                  <SelectItem key={f.key} value={f.key}>
                                    {f.label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => setAggregations(aggregations.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Visualization */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-4">
                Chart Type
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {CHART_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setChartType(type.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                      chartType === type.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      chartType === type.value
                        ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    )}>
                      {type.icon}
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="shared"
                checked={isShared}
                onCheckedChange={(checked) => setIsShared(checked as boolean)}
              />
              <Label htmlFor="shared">
                Share this report with team members
              </Label>
            </div>

            {/* Preview Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2">
              <h4 className="font-medium text-slate-900 dark:text-white">
                Report Summary
              </h4>
              <div className="text-sm text-slate-500 space-y-1">
                <p>Name: {reportName || 'Untitled'}</p>
                <p>Module: {selectedModuleData?.name || 'Not selected'}</p>
                <p>Type: {REPORT_TYPES.find(t => t.value === reportType)?.label}</p>
                <p>Columns: {columns.length} selected</p>
                <p>Filters: {filters.length} applied</p>
                {chartType !== 'none' && (
                  <p>Visualization: {CHART_TYPES.find(t => t.value === chartType)?.label}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Report
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportBuilderPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    }>
      <ReportBuilderContent />
    </Suspense>
  );
}
