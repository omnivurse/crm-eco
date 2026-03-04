'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Download,
  Loader2,
  AlertCircle,
  Table,
  BarChart3,
  UserCheck,
  Users,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { ExportButton, type ExportFormat } from '@crm-eco/ui/components/export-button';
import { DateRangePicker, type DateRange } from '@crm-eco/ui/components/date-range-picker';
import { getTemplateById, exportData, downloadExport } from '@/lib/reports';

interface ReportResult {
  data: Record<string, unknown>[];
  summary: Record<string, unknown>;
  rowCount: number;
  computedAt: string;
  fromCache: boolean;
}

export default function AdvisorReportClient() {
  const params = useParams();
  const templateId = params.templateId as string;
  const template = getTemplateById(templateId);

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('preview');
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [advisorSearch, setAdvisorSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [includeDownline, setIncludeDownline] = useState(false);

  if (!template) {
    return (
      <div className="max-w-7xl mx-auto text-center py-16">
        <AlertCircle className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Report Not Found
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          The advisor report template doesn&apos;t exist.
        </p>
        <Button variant="outline" asChild>
          <Link href="/crm/reports/advisors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Advisor Reports
          </Link>
        </Button>
      </div>
    );
  }

  const handleRunReport = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        templateKey: templateId,
        includeDownline,
      };

      if (dateRange.from) body.dateStart = dateRange.from.toISOString().split('T')[0];
      if (dateRange.to) body.dateEnd = dateRange.to.toISOString().split('T')[0];
      if (stateFilter) body.states = stateFilter.split(',').map((s) => s.trim());
      if (statusFilter) body.statuses = statusFilter.split(',').map((s) => s.trim());
      if (planFilter) body.planNames = planFilter.split(',').map((s) => s.trim());

      const response = await fetch('/api/reports/advisor/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute report');
      }

      const data: ReportResult = await response.json();
      setResult(data);
      setActiveTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!result || result.data.length === 0) return;

    const exportFormat = format === 'excel' ? 'xlsx' : format;
    const fileExt = format === 'excel' ? 'xlsx' : format;
    const filename = `${templateId}-${new Date().toISOString().split('T')[0]}`;

    const blob = exportData({
      format: exportFormat as 'csv' | 'xlsx' | 'pdf' | 'json',
      data: result.data,
      filename,
    });

    downloadExport(blob, `${filename}.${fileExt}`);
  };

  const handleReset = () => {
    setDateRange({ from: undefined, to: undefined });
    setAdvisorSearch('');
    setStateFilter('');
    setStatusFilter('');
    setPlanFilter('');
    setIncludeDownline(false);
    setResult(null);
    setError(null);
    setActiveTab('preview');
  };

  const getColumnHeaders = () => {
    if (!result || result.data.length === 0) return [];
    return Object.keys(result.data[0]);
  };

  const hasDateFilter = template.filters.includes('Date Range');
  const hasStateFilter = template.filters.includes('State');
  const hasStatusFilter = template.filters.includes('Status');
  const hasPlanFilter = template.filters.includes('Plan');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <Link
            href="/crm/reports/advisors"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Advisor Reports
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {template.name}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            {template.description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunReport}
            disabled={isRunning}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isRunning ? 'Running...' : 'Run Report'}
          </Button>
          <ExportButton
            onExport={handleExport}
            disabled={!result || result.data.length === 0}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filter Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-900 dark:text-white">Filters</span>
              </div>
              {filtersOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {filtersOpen && (
              <div className="p-4 pt-0 space-y-4">
                {/* Advisor Search */}
                <div className="space-y-2">
                  <Label htmlFor="advisorSearch">Advisor</Label>
                  <Input
                    id="advisorSearch"
                    placeholder="Search advisors..."
                    value={advisorSearch}
                    onChange={(e) => setAdvisorSearch(e.target.value)}
                  />
                </div>

                {/* Downline Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDownline}
                    onChange={(e) => setIncludeDownline(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Include downline
                  </span>
                </label>

                {/* Date Range */}
                {hasDateFilter && (
                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <DateRangePicker
                      value={dateRange}
                      onChange={setDateRange}
                      className="w-full"
                    />
                  </div>
                )}

                {/* State Filter */}
                {hasStateFilter && (
                  <div className="space-y-2">
                    <Label htmlFor="stateFilter">State</Label>
                    <Input
                      id="stateFilter"
                      placeholder="e.g. CA, TX, FL"
                      value={stateFilter}
                      onChange={(e) => setStateFilter(e.target.value)}
                    />
                    <p className="text-xs text-slate-400">Comma-separated</p>
                  </div>
                )}

                {/* Status Filter */}
                {hasStatusFilter && (
                  <div className="space-y-2">
                    <Label htmlFor="statusFilter">Status</Label>
                    <Input
                      id="statusFilter"
                      placeholder="e.g. active, pending"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    />
                    <p className="text-xs text-slate-400">Comma-separated</p>
                  </div>
                )}

                {/* Plan Filter */}
                {hasPlanFilter && (
                  <div className="space-y-2">
                    <Label htmlFor="planFilter">Plan</Label>
                    <Input
                      id="planFilter"
                      placeholder="e.g. Gold, Silver"
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                    />
                    <p className="text-xs text-slate-400">Comma-separated</p>
                  </div>
                )}

                {/* Reset Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="w-full"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  Reset Filters
                </Button>
              </div>
            )}
          </div>

          {/* Summary Card (when results available) */}
          {result && result.summary && (
            <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">
                Summary
              </h3>
              <div className="space-y-2">
                {Object.entries(result.summary).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                    </span>
                  </div>
                ))}
              </div>
              {result.fromCache && (
                <p className="text-xs text-slate-400 mt-3">
                  Cached · {new Date(result.computedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2">
                <Table className="w-4 h-4" />
                Results
                {result && (
                  <span className="ml-1 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded">
                    {result.rowCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="mt-4">
              <div className="glass-card rounded-xl p-8 border border-slate-200 dark:border-white/10 text-center">
                <UserCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  Ready to Run
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Configure your filters and click &quot;Run Report&quot; to see advisor performance data
                </p>
                {template.metrics && (
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {template.metrics.map((metric) => (
                      <span
                        key={metric}
                        className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  onClick={handleRunReport}
                  disabled={isRunning}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Run Report
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="results" className="mt-4">
              {result && result.data.length > 0 ? (
                <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Showing {result.data.length} rows
                      {result.fromCache && (
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                          (cached)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <UITable>
                      <TableHeader>
                        <TableRow>
                          {getColumnHeaders().map((col) => (
                            <TableHead key={col} className="whitespace-nowrap">
                              {col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.data.map((row, idx) => (
                          <TableRow key={idx}>
                            {getColumnHeaders().map((col) => (
                              <TableCell key={col} className="whitespace-nowrap">
                                {formatCellValue(row[col])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </UITable>
                  </div>
                </div>
              ) : (
                <div className="glass-card rounded-xl p-8 border border-slate-200 dark:border-white/10 text-center">
                  <Table className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                    No Results Yet
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Run the report to see results here
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    // Format as currency if it looks like money
    if (Math.abs(value) >= 100 && Number.isFinite(value)) {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return value.toLocaleString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
