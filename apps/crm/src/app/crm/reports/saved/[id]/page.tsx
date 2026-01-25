'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Save,
  Settings,
  BarChart3,
  Table,
  History,
  Loader2,
  AlertCircle,
  Star,
  Clock,
  Download,
  Edit,
  Trash2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
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
import { exportData, downloadExport } from '@/lib/reports';

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

interface RunHistory {
  id: string;
  executed_at: string;
  duration_ms: number;
  row_count: number;
  status: string;
  error_message?: string;
}

export default function SavedReportDetailPage() {
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
  const [history, setHistory] = useState<RunHistory[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  // Editable fields
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
      await fetch(`/api/reports/${reportId}/favorite`, { method: 'PATCH' });
      setReport({ ...report, is_favorite: !report.is_favorite });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/crm/reports/saved');
      }
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
      <div className="max-w-7xl mx-auto flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-7xl mx-auto text-center py-16">
        <AlertCircle className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Report Not Found
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          The report you're looking for doesn't exist.
        </p>
        <Link href="/crm/reports/saved">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Saved Reports
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <Link
            href="/crm/reports/saved"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Saved Reports
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {report.name}
            </h1>
            {report.is_favorite && (
              <Star className="w-5 h-5 text-amber-500 fill-current" />
            )}
          </div>
          {report.description && (
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              {report.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-2">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              {report.data_source}
            </span>
            {report.run_count !== undefined && (
              <span className="flex items-center gap-1">
                <Play className="w-4 h-4" />
                {report.run_count} runs
              </span>
            )}
            {report.last_run_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Last run {new Date(report.last_run_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleToggleFavorite}
            className={report.is_favorite ? 'text-amber-500' : ''}
          >
            <Star className={`w-4 h-4 ${report.is_favorite ? 'fill-current' : ''}`} />
          </Button>
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
          <ExportButton onExport={handleExport} disabled={results.length === 0} />
          <Button variant="outline" onClick={handleDelete} className="text-red-600">
            <Trash2 className="w-4 h-4" />
          </Button>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Table className="w-4 h-4" />
            Data
            {results.length > 0 && (
              <span className="ml-1 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded">
                {totalRows}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Report Configuration
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-500 dark:text-slate-400">Data Source</Label>
                    <p className="text-slate-900 dark:text-white">{report.data_source}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 dark:text-slate-400">
                      Columns ({report.columns.length})
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {report.columns.map((col) => (
                        <span
                          key={col}
                          className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                  {report.filters.length > 0 && (
                    <div>
                      <Label className="text-slate-500 dark:text-slate-400">
                        Filters ({report.filters.length})
                      </Label>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
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
              <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <Button
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={handleRunReport}
                    disabled={isRunning}
                  >
                    <Play className="w-4 h-4 mr-2" />
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
            <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
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
            <div className="glass-card rounded-xl p-8 border border-slate-200 dark:border-white/10 text-center">
              <Table className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                No Data Yet
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Run the report to see results
              </p>
              <Button
                onClick={handleRunReport}
                disabled={isRunning}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Play className="w-4 h-4 mr-2" />
                Run Report
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="glass-card rounded-xl p-6 border border-slate-200 dark:border-white/10 text-center">
            <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
              Run History
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Run history will be tracked here
            </p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="glass-card rounded-xl p-6 border border-slate-200 dark:border-white/10 max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Report Settings
            </h2>
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
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
