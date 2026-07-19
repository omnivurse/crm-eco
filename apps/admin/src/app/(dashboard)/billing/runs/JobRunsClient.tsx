'use client';

import { CaretDown, CaretRight, Play, WarningCircle } from '@phosphor-icons/react';
import { useState, useMemo, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { format } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';

interface JobRun {
  id: string;
  job_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  total_eligible: number;
  processed_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  error_log: unknown[] | null;
  metadata: Record<string, unknown> | null;
  triggered_by: string;
  trigger_details: string | null;
  created_at: string;
}

type StatusFilter = 'all' | 'running' | 'completed' | 'failed' | 'cancelled';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: 'bg-blue-100 text-blue-800 animate-pulse',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.cancelled}`}>
      {status}
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const styles: Record<string, string> = {
    cron: 'bg-purple-100 text-purple-700',
    manual: 'bg-amber-100 text-amber-700',
    api: 'bg-indigo-100 text-indigo-700',
    smoke_test: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[trigger] || styles.api}`}>
      {trigger}
    </span>
  );
}

function JobTypeBadge({ jobType }: { jobType: string }) {
  const styles: Record<string, string> = {
    billing: 'bg-amber-100 text-amber-800',
    commission: 'bg-violet-100 text-violet-800',
    email: 'bg-cyan-100 text-cyan-800',
    smoke_test: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[jobType] || styles.billing}`}>
      {jobType}
    </span>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

export function JobRunsClient({ jobRuns }: { jobRuns: JobRun[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredRuns = useMemo(() => {
    return jobRuns.filter((run) => {
      // Status filter
      if (statusFilter !== 'all' && run.status !== statusFilter) return false;

      // Date range filter
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(run.started_at) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(run.started_at) > to) return false;
      }

      return true;
    });
  }, [jobRuns, statusFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobRuns.length };
    for (const run of jobRuns) {
      counts[run.status] = (counts[run.status] || 0) + 1;
    }
    return counts;
  }, [jobRuns]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const hasCircuitBreaker = (run: JobRun): boolean => {
    if (!run.metadata) return false;
    const m = run.metadata as Record<string, unknown>;
    return Boolean(m.circuit_breaker_tripped || m.circuitBreakerTripped);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Job Runs"
        description="Audit log for billing and commission processing runs"
        icon={<Play weight="light" className="w-6 h-6" />}
        gradient="from-amber-500 to-orange-400"
        backHref="/billing"
        backLabel="Back to Billing"
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status filter tabs */}
            <div className="flex flex-wrap gap-1">
              {(['all', 'running', 'completed', 'failed', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    statusFilter === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {statusCounts[status] ? ` (${statusCounts[status]})` : ''}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-slate-500">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border rounded-md px-2 py-1 text-slate-700"
              />
              <label className="text-xs text-slate-500">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border rounded-md px-2 py-1 text-slate-700"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Play weight="light" className="h-5 w-5" />
            Job Runs
            <span className="text-sm font-normal text-slate-500">
              ({filteredRuns.length} {filteredRuns.length === 1 ? 'run' : 'runs'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRuns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2 pr-2 font-medium w-8"></th>
                    <th className="pb-2 pr-4 font-medium">Started At</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Trigger</th>
                    <th className="pb-2 pr-4 font-medium text-right">Processed</th>
                    <th className="pb-2 pr-4 font-medium text-right">✓</th>
                    <th className="pb-2 pr-4 font-medium text-right">✗</th>
                    <th className="pb-2 pr-4 font-medium text-right">Skipped</th>
                    <th className="pb-2 pr-4 font-medium text-right">Duration</th>
                    <th className="pb-2 font-medium">Circuit Breaker</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => {
                    const isExpanded = expandedId === run.id;
                    const cbTripped = hasCircuitBreaker(run);

                    return (
                      <Fragment key={run.id}>
                        <tr
                          className="border-b last:border-b-0 hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleExpand(run.id)}
                        >
                          <td className="py-2 pr-2 text-slate-400">
                            {isExpanded ? (
                              <CaretDown weight="light" className="h-4 w-4" />
                            ) : (
                              <CaretRight weight="light" className="h-4 w-4" />
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <div>
                              <p className="font-medium">
                                {format(new Date(run.started_at), 'MMM d, yyyy')}
                              </p>
                              <p className="text-xs text-slate-500">
                                {format(new Date(run.started_at), 'h:mm:ss a')}
                              </p>
                            </div>
                          </td>
                          <td className="py-2 pr-4"><StatusBadge status={run.status} /></td>
                          <td className="py-2 pr-4"><JobTypeBadge jobType={run.job_type} /></td>
                          <td className="py-2 pr-4"><TriggerBadge trigger={run.triggered_by} /></td>
                          <td className="py-2 pr-4 text-right font-mono">{run.processed_count}</td>
                          <td className="py-2 pr-4 text-right font-mono text-green-600">{run.success_count}</td>
                          <td className="py-2 pr-4 text-right font-mono text-red-600">{run.failure_count}</td>
                          <td className="py-2 pr-4 text-right font-mono text-slate-500">{run.skipped_count}</td>
                          <td className="py-2 pr-4 text-right font-mono text-slate-500">
                            {formatDuration(run.duration_ms)}
                          </td>
                          <td className="py-2">
                            {cbTripped ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                                <WarningCircle weight="light" className="h-3 w-3" />
                                Tripped
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={11} className="py-4 px-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Run Details */}
                                <div>
                                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Run Details
                                  </h4>
                                  <dl className="space-y-1 text-sm">
                                    <div className="flex gap-2">
                                      <dt className="text-slate-500 min-w-[120px]">Run ID:</dt>
                                      <dd className="font-mono text-xs text-slate-700 break-all">{run.id}</dd>
                                    </div>
                                    <div className="flex gap-2">
                                      <dt className="text-slate-500 min-w-[120px]">Total Eligible:</dt>
                                      <dd className="font-mono">{run.total_eligible}</dd>
                                    </div>
                                    {run.completed_at && (
                                      <div className="flex gap-2">
                                        <dt className="text-slate-500 min-w-[120px]">Completed At:</dt>
                                        <dd>{format(new Date(run.completed_at), 'MMM d, yyyy h:mm:ss a')}</dd>
                                      </div>
                                    )}
                                    {run.trigger_details && (
                                      <div className="flex gap-2">
                                        <dt className="text-slate-500 min-w-[120px]">Trigger Details:</dt>
                                        <dd className="text-slate-700">{run.trigger_details}</dd>
                                      </div>
                                    )}
                                  </dl>
                                </div>

                                {/* Metadata */}
                                {run.metadata && Object.keys(run.metadata).length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                      Metadata
                                    </h4>
                                    <pre className="text-xs bg-white border rounded-lg p-3 overflow-x-auto max-h-60 text-slate-700">
                                      {JSON.stringify(run.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {/* Error Log */}
                                {run.error_log && Array.isArray(run.error_log) && run.error_log.length > 0 && (
                                  <div className="md:col-span-2">
                                    <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
                                      Error Log ({run.error_log.length} {run.error_log.length === 1 ? 'entry' : 'entries'})
                                    </h4>
                                    <pre className="text-xs bg-red-50 border border-red-200 rounded-lg p-3 overflow-x-auto max-h-60 text-red-800">
                                      {JSON.stringify(run.error_log, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Play weight="light" className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              {jobRuns.length === 0
                ? 'No job runs recorded yet'
                : 'No runs match the current filters'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

