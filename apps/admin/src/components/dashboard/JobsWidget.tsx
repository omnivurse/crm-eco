'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from '@crm-eco/ui';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  Zap,
  Calendar,
  FileText,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';

interface JobRun {
  id: string;
  job_type: string;
  job_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  error_message: string | null;
  logs: any[];
  trigger_type: 'manual' | 'scheduled' | 'webhook' | 'system';
  created_at: string;
  triggered_by_profile?: {
    full_name: string;
  } | null;
}

interface JobsWidgetProps {
  organizationId: string;
}

const statusConfig = {
  pending: { icon: Clock, color: 'bg-slate-100 text-slate-600', label: 'Pending' },
  running: { icon: Loader2, color: 'bg-blue-100 text-blue-600', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', label: 'Completed' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-600', label: 'Failed' },
  cancelled: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', label: 'Cancelled' },
};

const jobTypeLabels: Record<string, string> = {
  eligibility_check: 'Eligibility Check',
  billing_run: 'Billing Run',
  commission_calculation: 'Commission Calculation',
  nacha_export: 'NACHA Export',
  nacha_import: 'NACHA Import',
  member_import: 'Member Import',
  agent_import: 'Agent Import',
  report_generation: 'Report Generation',
  data_sync: 'Data Sync',
  cleanup: 'Data Cleanup',
  custom: 'Custom Job',
};

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function JobsWidget({ organizationId }: JobsWidgetProps) {
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobRun | null>(null);

  const supabase = createClient();

  const fetchJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('job_runs')
        .select(`
          id,
          job_type,
          job_name,
          status,
          started_at,
          completed_at,
          duration_ms,
          records_processed,
          records_succeeded,
          records_failed,
          error_message,
          logs,
          trigger_type,
          created_at,
          triggered_by_profile:profiles!job_runs_triggered_by_fkey(full_name)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        // Table might not exist yet - that's ok
        if (error.code === '42P01') {
          setJobs([]);
          return;
        }
        throw error;
      }
      setJobs((data || []) as unknown as JobRun[]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    fetchJobs();

    // Poll for running jobs
    const interval = setInterval(() => {
      if (jobs.some(j => j.status === 'running' || j.status === 'pending')) {
        fetchJobs();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchJobs, jobs]);

  const runningCount = jobs.filter(j => j.status === 'running').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Job Runs</CardTitle>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {runningCount > 0 && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {runningCount} running
                    </span>
                  )}
                  {failedCount > 0 && (
                    <span className="text-red-500">{failedCount} failed</span>
                  )}
                  {runningCount === 0 && failedCount === 0 && (
                    <span>Recent job activity</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={fetchJobs}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Link href="/ops/jobs">
                <Button size="sm" variant="ghost">
                  View all
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-2xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-medium text-slate-600 mb-1">No recent jobs</p>
              <p className="text-sm text-slate-400">Jobs will appear here when run</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.slice(0, 6).map((job) => {
                const config = statusConfig[job.status];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={job.id}
                    className="group flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedJob(job)}
                  >
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <StatusIcon className={`w-4 h-4 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {job.job_name || jobTypeLabels[job.job_type] || job.job_type}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-2">
                        <span>{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                        {job.duration_ms && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>{formatDuration(job.duration_ms)}</span>
                          </>
                        )}
                      </p>
                    </div>

                    {job.status === 'completed' && job.records_processed > 0 && (
                      <span className="text-xs text-slate-400">
                        {job.records_succeeded}/{job.records_processed}
                      </span>
                    )}

                    <Badge className={config.color}>
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details Modal */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedJob && (
                <>
                  {(() => {
                    const config = statusConfig[selectedJob.status];
                    const StatusIcon = config.icon;
                    return (
                      <div className={`p-1.5 rounded ${config.color}`}>
                        <StatusIcon className={`w-4 h-4 ${selectedJob.status === 'running' ? 'animate-spin' : ''}`} />
                      </div>
                    );
                  })()}
                  {selectedJob.job_name || jobTypeLabels[selectedJob.job_type]}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="font-semibold text-slate-700 capitalize">{selectedJob.status}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Duration</p>
                  <p className="font-semibold text-slate-700">{formatDuration(selectedJob.duration_ms)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Processed</p>
                  <p className="font-semibold text-slate-700">{selectedJob.records_processed}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Success Rate</p>
                  <p className="font-semibold text-slate-700">
                    {selectedJob.records_processed > 0
                      ? `${Math.round((selectedJob.records_succeeded / selectedJob.records_processed) * 100)}%`
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Started</p>
                  <p className="text-slate-700">
                    {selectedJob.started_at
                      ? format(new Date(selectedJob.started_at), 'MMM d, yyyy h:mm:ss a')
                      : 'Not started'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Completed</p>
                  <p className="text-slate-700">
                    {selectedJob.completed_at
                      ? format(new Date(selectedJob.completed_at), 'MMM d, yyyy h:mm:ss a')
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Error */}
              {selectedJob.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-medium text-red-600 mb-1">Error</p>
                  <p className="text-sm text-red-700">{selectedJob.error_message}</p>
                </div>
              )}

              {/* Logs */}
              {selectedJob.logs && selectedJob.logs.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Logs</p>
                  <ScrollArea className="h-48 rounded-lg border bg-slate-900 p-3">
                    <div className="font-mono text-xs text-slate-300 space-y-1">
                      {selectedJob.logs.map((log: any, i: number) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-slate-500">
                            {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : ''}
                          </span>
                          <span className={
                            log.level === 'error' ? 'text-red-400' :
                            log.level === 'warn' ? 'text-amber-400' :
                            'text-slate-300'
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-slate-400 flex items-center gap-4">
                <span>Trigger: {selectedJob.trigger_type}</span>
                {selectedJob.triggered_by_profile && (
                  <span>By: {selectedJob.triggered_by_profile.full_name}</span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
