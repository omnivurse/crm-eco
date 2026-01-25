'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Save,
  Download,
  Filter,
  Settings,
  BarChart3,
  Table,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
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
import { getTemplateById, exportData, downloadExport } from '@crm-eco/shared';

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const template = getTemplateById(templateId);

  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reportName, setReportName] = useState(template?.name || '');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [activeTab, setActiveTab] = useState('preview');

  useEffect(() => {
    if (template) {
      setReportName(template.name);
    }
  }, [template]);

  if (!template) {
    return (
      <div className="max-w-7xl mx-auto text-center py-16">
        <AlertCircle className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Template Not Found
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          The template you're looking for doesn't exist.
        </p>
        <Link href="/crm/reports/templates">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </Link>
      </div>
    );
  }

  const handleRunReport = async () => {
    setIsRunning(true);
    setError(null);
    setResults([]);

    try {
      const filters = [...template.filters];

      // Add date range filters if set
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
          dataSource: template.dataSource,
          columns: template.columns,
          filters,
          grouping: template.grouping,
          aggregations: template.aggregations,
          sorting: template.sorting,
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
      setActiveTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveReport = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          description: template.description,
          dataSource: template.dataSource,
          columns: template.columns,
          filters: template.filters,
          grouping: template.grouping,
          aggregations: template.aggregations,
          sorting: template.sorting,
          templateCategory: template.category,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save report');
      }

      const data = await response.json();
      router.push(`/crm/reports/saved/${data.report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSaving(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (results.length === 0) return;

    const result = exportData(results, template.columns, format, undefined, {
      filename: `${reportName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`,
    });

    downloadExport(result);
  };

  const getColumnHeaders = () => {
    if (results.length === 0) return template.columns;
    return Object.keys(results[0]);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <Link
            href="/crm/reports/templates"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {template.name}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            {template.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {template.category}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
              {template.dataSource}
            </span>
          </div>
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
            disabled={results.length === 0}
          />
          <Button
            variant="outline"
            onClick={handleSaveReport}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Report
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Configuration</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reportName">Report Name</Label>
                <Input
                  id="reportName"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Enter report name"
                />
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Data Source</Label>
                <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg">
                  {template.dataSource}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Columns ({template.columns.length})</Label>
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg max-h-32 overflow-y-auto">
                  {template.columns.map((col) => (
                    <div key={col} className="py-0.5">
                      {col}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
                {results.length > 0 && (
                  <span className="ml-1 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded">
                    {totalRows}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="mt-4">
              <div className="glass-card rounded-xl p-6 border border-slate-200 dark:border-white/10 text-center">
                <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  Ready to Run
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Click "Run Report" to execute this template and see the results
                </p>
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
