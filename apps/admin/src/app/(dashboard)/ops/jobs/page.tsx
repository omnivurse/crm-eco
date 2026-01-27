'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui';
import {
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Play,
  Calendar,
  Download,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

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
  error_details: any;
  logs: any[];
  trigger_type: 'manual' | 'scheduled' | 'webhook' | 'system';
  created_at: string;
  triggered_by_profile?: {
    full_name: string;
    email: string;
  } | null;
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

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobRun | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const supabase = createClient();

  const fetchJobs = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      let query = supabase
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
          error_details,
          logs,
          trigger_type,
          created_at,
          triggered_by_profile:profiles!job_runs_triggered_by_fkey(full_name, email)
        `, { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('job_type', typeFilter);
      }

      if (searchQuery) {
        query = query.ilike('job_name', `%${searchQuery}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setJobs((data || []) as unknown as JobRun[]);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId, page, statusFilter, typeFilter, searchQuery]);

  // Get organization ID on mount
  useEffect(() => {
    async function getOrgId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setOrganizationId(profile.organization_id);
      }
    }

    getOrgId();
  }, [supabase]);

  useEffect(() => {
    if (organizationId) {
      fetchJobs();
    }
  }, [organizationId, fetchJobs]);

  // Poll for running jobs
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending');
    if (!hasRunning) return;

    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Job History</h1>
            <p className="text-slate-500">View and manage job runs</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchJobs}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(0);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Job Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(jobTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500">No jobs found</p>
                <p className="text-sm text-slate-400">Jobs will appear here when they run</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const config = statusConfig[job.status];
                    const StatusIcon = config.icon;

                    return (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelectedJob(job)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-700">
                              {job.job_name || jobTypeLabels[job.job_type] || job.job_type}
                            </p>
                            <p className="text-xs text-slate-400">{job.job_type}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={config.color}>
                            <StatusIcon className={`w-3 h-3 mr-1 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500 capitalize">{job.trigger_type}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-slate-700">
                              {job.started_at ? format(new Date(job.started_at), 'MMM d, h:mm a') : '-'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-700">{formatDuration(job.duration_ms)}</span>
                        </TableCell>
                        <TableCell>
                          {job.records_processed > 0 ? (
                            <div className="text-sm">
                              <span className="text-emerald-600">{job.records_succeeded}</span>
                              <span className="text-slate-400"> / </span>
                              <span className="text-slate-700">{job.records_processed}</span>
                              {job.records_failed > 0 && (
                                <span className="text-red-500 ml-1">({job.records_failed} failed)</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-slate-500">
                Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-500">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Job Details Modal */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
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
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <Badge className={statusConfig[selectedJob.status].color}>
                    {statusConfig[selectedJob.status].label}
                  </Badge>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Duration</p>
                  <p className="font-semibold text-slate-700">{formatDuration(selectedJob.duration_ms)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Records</p>
                  <p className="font-semibold text-slate-700">
                    {selectedJob.records_processed > 0 ? (
                      <>
                        <span className="text-emerald-600">{selectedJob.records_succeeded}</span>
                        <span className="text-slate-400"> / </span>
                        {selectedJob.records_processed}
                      </>
                    ) : (
                      '-'
                    )}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Success Rate</p>
                  <p className="font-semibold text-slate-700">
                    {selectedJob.records_processed > 0
                      ? `${Math.round((selectedJob.records_succeeded / selectedJob.records_processed) * 100)}%`
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Started</p>
                  <p className="text-slate-700">
                    {selectedJob.started_at
                      ? format(new Date(selectedJob.started_at), 'MMM d, yyyy h:mm:ss a')
                      : 'Not started'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Completed</p>
                  <p className="text-slate-700">
                    {selectedJob.completed_at
                      ? format(new Date(selectedJob.completed_at), 'MMM d, yyyy h:mm:ss a')
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Trigger Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Trigger Type</p>
                  <p className="text-slate-700 capitalize">{selectedJob.trigger_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Triggered By</p>
                  <p className="text-slate-700">
                    {selectedJob.triggered_by_profile?.full_name || 'System'}
                  </p>
                </div>
              </div>

              {/* Error */}
              {selectedJob.error_message && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-600 mb-2">Error</p>
                  <p className="text-sm text-red-700 font-mono">{selectedJob.error_message}</p>
                  {selectedJob.error_details && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-500 cursor-pointer">Show details</summary>
                      <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                        {JSON.stringify(selectedJob.error_details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Logs */}
              {selectedJob.logs && selectedJob.logs.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Logs</p>
                  <ScrollArea className="h-64 rounded-lg border bg-slate-900 p-4">
                    <div className="font-mono text-xs text-slate-300 space-y-1">
                      {selectedJob.logs.map((log: any, i: number) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-slate-500 shrink-0">
                            {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss.SSS') : `[${i}]`}
                          </span>
                          <span className={
                            log.level === 'error' ? 'text-red-400' :
                            log.level === 'warn' ? 'text-amber-400' :
                            log.level === 'info' ? 'text-blue-400' :
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

              {/* Job ID */}
              <div className="pt-4 border-t">
                <p className="text-xs text-slate-400">
                  Job ID: <code className="bg-slate-100 px-1 rounded">{selectedJob.id}</code>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
