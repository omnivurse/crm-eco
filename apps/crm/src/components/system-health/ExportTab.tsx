'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Loader2,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  FileJson,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Filter,
  ExternalLink,
  HardDrive,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportJob {
  id: string;
  name: string | null;
  export_type: string;
  format: string;
  status: string;
  total_rows: number | null;
  processed_rows: number | null;
  file_name: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

const STATUS_FILTERS = ['all', 'pending', 'processing', 'completed', 'failed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  csv: <FileSpreadsheet className="w-4 h-4" />,
  json: <FileJson className="w-4 h-4" />,
  xlsx: <FileSpreadsheet className="w-4 h-4" />,
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; bg: string; text: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
  processing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: 'Processing', bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
  completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Completed', bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
  failed: { icon: <XCircle className="w-3.5 h-3.5" />, label: 'Failed', bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExportTab() {
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [creating, setCreating] = useState(false);

  // New export form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newExportType, setNewExportType] = useState('records');
  const [newFormat, setNewFormat] = useState('csv');
  const [newName, setNewName] = useState('');

  const fetchExports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/crm/export?${params}`);
      if (res.ok) {
        const data = await res.json();
        setExports(data.exports || []);
        setTotal(data.total || 0);
      } else {
        toast.error('Failed to load exports');
      }
    } catch {
      toast.error('Failed to load exports');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  // ---------------------------------------------------------------------------
  // Create New Export
  // ---------------------------------------------------------------------------

  async function handleCreateExport() {
    setCreating(true);
    try {
      const res = await fetch('/api/crm/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName || undefined,
          export_type: newExportType,
          format: newFormat,
        }),
      });

      if (res.ok) {
        toast.success('Export job created');
        setShowNewForm(false);
        setNewName('');
        await fetchExports();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create export');
      }
    } catch {
      toast.error('Failed to create export');
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Download
  // ---------------------------------------------------------------------------

  function handleDownload(exp: ExportJob) {
    if (!exp.file_url) {
      toast.error('File not available');
      return;
    }

    // Data URL download
    if (exp.file_url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = exp.file_url;
      a.download = exp.file_name || `export.${exp.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Download started');
      return;
    }

    // Regular URL
    window.open(exp.file_url, '_blank');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatBytes(bytes: number | null) {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isExpired(exp: ExportJob) {
    if (!exp.expires_at) return false;
    return new Date(exp.expires_at) < new Date();
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading && exports.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Exports</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Export history and create new data exports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchExports} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button
            onClick={() => setShowNewForm(!showNewForm)}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400"
          >
            <Plus className="w-4 h-4 mr-2" /> New Export
          </Button>
        </div>
      </div>

      {/* New Export Form */}
      {showNewForm && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Create New Export</CardTitle>
            <CardDescription>Export your CRM data in various formats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My export..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Export Type
                </label>
                <select
                  value={newExportType}
                  onChange={(e) => setNewExportType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none"
                >
                  <option value="records">Records</option>
                  <option value="report">Report</option>
                  <option value="audit_logs">Audit Logs</option>
                  <option value="analytics">Analytics</option>
                  <option value="backup">Full Backup</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Format
                </label>
                <select
                  value={newFormat}
                  onChange={(e) => setNewFormat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="xlsx">Excel (XLSX)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewForm(false)}>Cancel</Button>
              <Button onClick={handleCreateExport} disabled={creating}>
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Create Export
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === f
                ? 'bg-teal-500/10 border-teal-500/50 text-teal-700 dark:text-teal-400'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'all' && total > 0 && ` (${total})`}
          </button>
        ))}
      </div>

      {/* Exports List */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardContent className="pt-6">
          {exports.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <HardDrive className="w-14 h-14 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No exports found</p>
              <p className="text-sm mt-1">
                {statusFilter !== 'all' ? 'Try a different status filter' : 'Create an export to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {exports.map((exp) => {
                const statusCfg = STATUS_CONFIG[exp.status] || STATUS_CONFIG.pending;
                const expired = isExpired(exp);
                const formatIcon = FORMAT_ICONS[exp.format] || <FileText className="w-4 h-4" />;

                return (
                  <div
                    key={exp.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                          {formatIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-slate-900 dark:text-white text-sm truncate">
                              {exp.name || exp.file_name || 'Export'}
                            </h4>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                              {statusCfg.icon} {statusCfg.label}
                            </span>
                            {expired && exp.status === 'completed' && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                                <AlertTriangle className="w-3 h-3" /> Expired
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Type: {exp.export_type} | Format: {exp.format.toUpperCase()}
                            {exp.total_rows != null && (
                              <span className="ml-3">{exp.total_rows.toLocaleString()} rows</span>
                            )}
                            {exp.file_size_bytes != null && (
                              <span className="ml-3">{formatBytes(exp.file_size_bytes)}</span>
                            )}
                          </p>
                          {exp.error_message && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                              {exp.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">{formatDate(exp.created_at)}</p>
                          {exp.completed_at && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Done: {formatDate(exp.completed_at)}
                            </p>
                          )}
                        </div>
                        {exp.status === 'completed' && exp.file_url && !expired && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(exp)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
