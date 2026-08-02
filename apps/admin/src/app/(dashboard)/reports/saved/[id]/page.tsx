'use client';

import { CaretLeft, ChartBar, CircleNotch, Clock, ClockCounterClockwise, FloppyDisk, Play, Star, Table, Trash, WarningCircle } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
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
import { exportData, downloadExport } from '@crm-eco/shared';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';

interface SavedReport {
  id: string;
  name: string;
  description?: string;
  data_source: string;
  columns: string[];
  filters: Array<{ column: string; operator: string; value: unknown }>;
  grouping: Array<{ column: string; label: string }>;
  aggregations: Array<{ column: string; type: string; alias: string }>;
  sorting: Array<{ column: string; direction: string }>;
  template_category?: string;
  run_count?: number;
  last_run_at?: string;
  is_favorite?: boolean;
  created_at: string;
}

export default function AdminSavedReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = params.id as string;
  const autoRun = searchParams.get('run') === 'true';

  const [report, setReport] = useState<SavedReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/reports/${reportId}`);
        if (res.ok) {
          const data = await res.json();
          setReport(data.report);
          setReportName(data.report.name);
          setReportDescription(data.report.description || '');
        } else {
          setError('Report not found');
        }
      } catch (err) {
        setError('Failed to load report');
      } finally {
        setIsLoading(false);
      }
    }
    fetchReport();
  }, [reportId]);

  useEffect(() => {
    if (autoRun && report && !isRunning) {
      handleRunReport();
    }
  }, [autoRun, report]);

  const handleRunReport = async () => {
    if (!report) return;

    setIsRunning(true);
    setError(null);
    setResults([]);

    try {
      const filters = [...report.filters];

      if (dateRange.from) {
        filters.push({
          column: 'created_at',
          operator: 'gte',
          value: dateRange.from.toISOString(),
        });
      }
      if (dateRange.to) {
        filters.push({
          column: 'created_at',
          operator: 'lte',
          value: dateRange.to.toISOString(),
        });
      }

      const response = await fetch('/api/reports/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSource: report.data_source,
          columns: report.columns,
          filters,
          grouping: report.grouping,
          aggregations: report.aggregations,
          sorting: report.sorting,
          page: 1,
          pageSize: 100,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute report');
      }

      const data = await response.json();
      setResults(data.data || []);
      setTotalRows(data.total || 0);
      setActiveTab('data');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!report) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          description: reportDescription,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      const data = await response.json();
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!report) return;

    try {
      const res = await fetch(`/api/reports/${reportId}/favorite`, { method: 'PATCH' });
      if (!res.ok) {
        console.error('Failed to toggle favorite');
        return;
      }
      setReport({ ...report, is_favorite: !report.is_favorite });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDelete = async () => {
    if (!(await confirmDialog({ title: 'Delete this report?', confirmLabel: 'Delete', destructive: true }))) return;

    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || 'Failed to delete report');
        return;
      }
      router.push('/reports/saved');
    } catch (err) {
      setError('Failed to delete report');
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!report || results.length === 0) return;

    const result = exportData(results, report.columns, format, undefined, {
      filename: `${reportName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`,
    });

    downloadExport(result);
  };

  const getColumnHeaders = () => {
    if (results.length === 0) return report?.columns || [];
    return Object.keys(results[0]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <CircleNotch weight="light" className="w-8 h-8 animate-spin text-[#0891b2]" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-16">
        <WarningCircle weight="light" className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h1 className="mb-2 text-xl font-semibold text-slate-900">Report not found</h1>
        <p className="text-slate-500 mb-4">
          The report you're looking for doesn't exist.
        </p>
        <Link href="/reports/saved">
          <Button variant="outline">
            <CaretLeft weight="light" className="mr-1.5 h-4 w-4" aria-hidden />
            Back to saved reports
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EntityPageHeader
        backHref="/reports/saved"
        backLabel="Saved reports"
        title={report.name}
        description={report.description}
        subtitle={
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <ChartBar weight="light" className="h-4 w-4" aria-hidden />
              {report.data_source}
            </span>
            {report.run_count !== undefined && (
              <span className="flex items-center gap-1">
                <Play weight="light" className="h-4 w-4" aria-hidden />
                {report.run_count} runs
              </span>
            )}
            {report.last_run_at && (
              <span className="flex items-center gap-1">
                <Clock weight="light" className="h-4 w-4" aria-hidden />
                Last run {new Date(report.last_run_at).toLocaleDateString()}
              </span>
            )}
          </div>
        }
        badges={
          report.is_favorite ? (
            <Star weight="light" className="h-5 w-5 text-amber-500 fill-current" aria-label="Favorite" />
          ) : undefined
        }
        secondaryActions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFavorite}
              className={report.is_favorite ? 'text-amber-500' : ''}
            >
              <Star weight="light" className={`h-4 w-4 ${report.is_favorite ? 'fill-current' : ''}`} aria-hidden />
            </Button>
            <ExportButton onExport={handleExport} disabled={results.length === 0} />
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600">
              <Trash weight="light" className="h-4 w-4" aria-hidden />
            </Button>
          </>
        }
        primaryAction={
          <Button size="sm" onClick={handleRunReport} disabled={isRunning}>
            {isRunning ? (
              <CircleNotch weight="light" className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play weight="light" className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            {isRunning ? 'Running...' : 'Run report'}
          </Button>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <WarningCircle weight="light" className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <ChartBar weight="light" className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Table weight="light" className="w-4 h-4" />
            Data
            {results.length > 0 && (
              <span className="ml-1 text-xs bg-[#0891b2]/10 text-[#0891b2] px-1.5 py-0.5 rounded">
                {totalRows}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <ClockCounterClockwise weight="light" className="w-4 h-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  Report Configuration
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-500">Data Source</Label>
                    <p className="text-slate-900">{report.data_source}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Columns ({report.columns.length})</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {report.columns.map((col) => (
                        <span
                          key={col}
                          className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                  {report.filters.length > 0 && (
                    <div>
                      <Label className="text-slate-500">Filters ({report.filters.length})</Label>
                      <div className="text-sm text-slate-600 mt-1">
                        {report.filters.map((f, i) => (
                          <div key={i}>
                            {f.column} {f.operator} {String(f.value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleRunReport}
                    disabled={isRunning}
                  >
                    <Play weight="light" className="w-4 h-4 mr-2" />
                    Run Report
                  </Button>
                  <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    className="w-full"
                    placeholder="Add date filter"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          {results.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Showing {results.length} of {totalRows} rows
                </p>
              </div>
              <div className="overflow-x-auto">
                <UITable>
                  <TableHeader>
                    <TableRow>
                      {getColumnHeaders().map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">
                          {col.replace(/_/g, ' ').replace(/\./g, ' ')}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((row, idx) => (
                      <TableRow key={idx}>
                        {getColumnHeaders().map((col) => (
                          <TableCell key={col} className="whitespace-nowrap">
                            {String(row[col] ?? '-')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </UITable>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
              <Table weight="light" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">No Data Yet</h3>
              <p className="text-sm text-slate-500 mb-4">Run the report to see results</p>
              <Button
                onClick={handleRunReport}
                disabled={isRunning}
              >
                <Play weight="light" className="w-4 h-4 mr-2" />
                Run Report
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
            <ClockCounterClockwise weight="light" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">Run history</h3>
            <p className="text-sm text-slate-500">Run history will be tracked here</p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="bg-white rounded-xl p-6 border border-slate-200 max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Report settings</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Report Name</Label>
                <Input
                  id="name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? (
                  <CircleNotch weight="light" className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FloppyDisk weight="light" className="w-4 h-4 mr-2" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
