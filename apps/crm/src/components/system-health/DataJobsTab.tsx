'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlayCircle,
  Filter,
  Layers,
  Trash2,
  Merge,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataJob {
  id: string;
  job_type: string;
  name: string | null;
  status: string;
  config: Record<string, unknown>;
  filters: Record<string, unknown>;
  total_records: number | null;
  processed_records: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
}

const STATUS_FILTERS = ['all', 'pending', 'processing', 'completed', 'failed', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const JOB_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  deduplicate: { icon: <Layers className="w-4 h-4" />, label: 'Deduplicate', color: 'text-blue-600 dark:text-blue-400' },
  merge: { icon: <Merge className="w-4 h-4" />, label: 'Merge', color: 'text-purple-600 dark:text-purple-400' },
  mass_update: { icon: <Pencil className="w-4 h-4" />, label: 'Mass Update', color: 'text-amber-600 dark:text-amber-400' },
  mass_delete: { icon: <Trash2 className="w-4 h-4" />, label: 'Mass Delete', color: 'text-red-600 dark:text-red-400' },
  enrich: { icon: <Sparkles className="w-4 h-4" />, label: 'Enrich', color: 'text-teal-600 dark:text-teal-400' },
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; bg: string; text: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
  processing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: 'Processing', bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
  review: { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Review', bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' },
  completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Completed', bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
  failed: { icon: <XCircle className="w-3.5 h-3.5" />, label: 'Failed', bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
  cancelled: { icon: <XCircle className="w-3.5 h-3.5" />, label: 'Cancelled', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-500' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataJobsTab() {
  const [jobs, setJobs] = useState<DataJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/crm/data-jobs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setTotal(data.total || 0);
      } else {
        toast.error('Failed to load data jobs');
      }
    } catch {
      toast.error('Failed to load data jobs');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getProgress(job: DataJob): number | null {
    if (!job.total_records || job.total_records === 0) return null;
    return Math.round(((job.processed_records || 0) / job.total_records) * 100);
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading && jobs.length === 0) {
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data Jobs</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Import, export, and data administration jobs
          </p>
        </div>
        <Button onClick={fetchJobs} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

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

      {/* Jobs List */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardContent className="pt-6">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Database className="w-14 h-14 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No data jobs found</p>
              <p className="text-sm mt-1">
                {statusFilter !== 'all' ? 'Try a different status filter' : 'Data jobs will appear here when created'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const typeConfig = JOB_TYPE_CONFIG[job.job_type] || {
                  icon: <Database className="w-4 h-4" />,
                  label: job.job_type,
                  color: 'text-slate-600 dark:text-slate-400',
                };
                const statusCfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                const progress = getProgress(job);

                return (
                  <div
                    key={job.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 ${typeConfig.color} shrink-0`}>
                          {typeConfig.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-slate-900 dark:text-white text-sm truncate">
                              {job.name || typeConfig.label}
                            </h4>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                              {statusCfg.icon} {statusCfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Type: {typeConfig.label}
                            {job.total_records != null && (
                              <span className="ml-3">
                                Records: {job.processed_records ?? 0}/{job.total_records}
                              </span>
                            )}
                          </p>
                          {job.error_message && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                              {job.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">{formatDate(job.created_at)}</p>
                        {job.completed_at && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Done: {formatDate(job.completed_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {progress !== null && job.status === 'processing' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
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
