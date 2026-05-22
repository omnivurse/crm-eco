import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { Activity, CheckCircle, XCircle, Clock, Timer, Hash, AlertTriangle } from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';
import { RunNowPanel } from './RunNowPanel';

interface JobRun {
  id: string;
  organization_id: string;
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

async function getCommissionJobRuns(orgId: string): Promise<JobRun[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase.from('billing_job_runs') as any)
    .select('*')
    .eq('organization_id', orgId)
    .in('job_type', ['commission', 'commission_accrual'])
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching commission job runs:', error);
    return [];
  }

  return (data || []) as JobRun[];
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-emerald-100 text-emerald-700">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case 'running':
      return (
        <Badge className="bg-blue-100 text-blue-700">
          <Clock className="w-3 h-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-700">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge className="bg-slate-100 text-slate-600">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getTriggeredByBadge(triggeredBy: string) {
  switch (triggeredBy) {
    case 'cron':
      return <Badge variant="outline" className="text-xs">Cron</Badge>;
    case 'manual':
      return <Badge className="bg-purple-100 text-purple-700 text-xs">Manual</Badge>;
    case 'api':
      return <Badge className="bg-cyan-100 text-cyan-700 text-xs">API</Badge>;
    case 'smoke_test':
      return <Badge className="bg-amber-100 text-amber-700 text-xs">Test</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{triggeredBy}</Badge>;
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default async function CommissionRunsPage() {
  const tenant = await getActiveTenant();

  if (!tenant) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-slate-500">No organization selected</p>
      </div>
    );
  }

  const runs = await getCommissionJobRuns(tenant.organizationId);

  // Current month for the "Run now" button
  const now = new Date();
  const currentMonth = format(now, 'MMMM yyyy');
  const currentPeriod = format(now, 'yyyy-MM');

  // Summary stats
  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;
  const lastRun = runs[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Job Runs"
        description="History of commission accrual processing runs"
        icon={<Activity className="w-6 h-6" />}
        gradient="from-emerald-500 to-teal-400"
        backHref="/commissions"
        backLabel="Commissions"
        actions={
          <RunNowPanel
            organizationId={tenant.organizationId}
            currentMonth={currentMonth}
            currentPeriod={currentPeriod}
          />
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Hash className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRuns}</p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedRuns}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{failedRuns}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Timer className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {lastRun ? formatDuration(lastRun.duration_ms) : '—'}
                </p>
                <p className="text-sm text-muted-foreground">Last Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
          <CardDescription>
            {totalRuns} commission processing run{totalRuns !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-lg font-medium">No commission runs yet</p>
              <p className="text-sm text-muted-foreground">
                Click &quot;Run now&quot; to trigger the first commission accrual
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Started</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Trigger</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Job Type</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">Duration</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">Eligible</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">Processed</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">
                      <span className="text-emerald-600">✓</span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">
                      <span className="text-red-600">✗</span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(run.started_at), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(run.started_at), 'h:mm a')}
                            {' · '}
                            {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(run.status)}</td>
                      <td className="py-3 px-4">{getTriggeredByBadge(run.triggered_by)}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs capitalize">
                          {run.job_type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-mono">
                        {formatDuration(run.duration_ms)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm">{run.total_eligible}</td>
                      <td className="py-3 px-4 text-right text-sm">{run.processed_count}</td>
                      <td className="py-3 px-4 text-right text-sm text-emerald-600 font-medium">
                        {run.success_count}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-red-600 font-medium">
                        {run.failure_count > 0 ? run.failure_count : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-slate-500">
                        {run.skipped_count > 0 ? run.skipped_count : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Error details for failed runs */}
          {runs.some((r) => r.status === 'failed' && r.error_log && (r.error_log as unknown[]).length > 0) && (
            <div className="border-t px-4 py-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Recent Errors</p>
              {runs
                .filter((r) => r.status === 'failed' && r.error_log && (r.error_log as unknown[]).length > 0)
                .slice(0, 3)
                .map((run) => (
                  <div key={run.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs text-red-600 mb-1">
                      {format(new Date(run.started_at), 'MMM d, yyyy h:mm a')}
                    </p>
                    <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">
                      {JSON.stringify(run.error_log, null, 2).slice(0, 500)}
                    </pre>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
