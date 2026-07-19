import { ArrowDownRight, CheckCircle, Clock, Funnel, Hourglass, PaperPlaneTilt, Prohibit, XCircle } from '@phosphor-icons/react/dist/ssr';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

// ---------------------------------------------------------------------------
// SLICE E3 — enrollment FUNNEL (apps/admin /analytics/funnel).
//
// Server component. Owner/admin gate via getActiveTenant().role (mirrors
// analytics/actuarial/page.tsx). Pulls the funnel through the SSR cookie
// client RPC public.get_enrollment_funnel (RLS/auth enforced inside the
// SECURITY-DEFINER function). Degrades gracefully if the RPC is absent (the
// E3 draft has not yet been applied to prod) or errors — renders a soft
// "not available" state instead of crashing.
// ---------------------------------------------------------------------------

interface StageReached {
  started: number;
  submitted: number;
  pending_review: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

interface StageMetric {
  avg: number | null;
  median: number | null;
}

interface FunnelData {
  months: number;
  cohort_total: number;
  stage_reached: StageReached;
  current_status_counts: Record<string, number>;
  conversion: {
    submit_rate: number | null;
    approval_rate: number | null;
  };
  time_in_stage_days: {
    created_to_submitted: StageMetric;
    submitted_to_decision: StageMetric;
  };
}

function pct(n: number, total: number): number {
  if (!total || total <= 0) return 0;
  return (n / total) * 100;
}

function asPercentLabel(rate: number | null): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function asDays(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} d`;
}

// The ordered funnel ladder. drop-off is computed against the PRIOR stage.
const STAGES: {
  key: keyof StageReached;
  label: string;
  description: string;
  icon: React.ReactNode;
  barClass: string;
}[] = [
  { key: 'started', label: 'Started', description: 'Enrollments created in the cohort window', icon: <Funnel weight="light" className="h-4 w-4 text-slate-400" />, barClass: 'bg-slate-400' },
  { key: 'submitted', label: 'Submitted', description: 'Reached submission (submitted_at set)', icon: <PaperPlaneTilt weight="light" className="h-4 w-4 text-blue-500" />, barClass: 'bg-blue-500' },
  { key: 'pending_review', label: 'In Review', description: 'submitted / pending_review / more_info', icon: <Hourglass weight="light" className="h-4 w-4 text-amber-500" />, barClass: 'bg-amber-500' },
  { key: 'approved', label: 'Approved', description: 'approved_at set, or active', icon: <CheckCircle weight="light" className="h-4 w-4 text-green-500" />, barClass: 'bg-green-500' },
];

async function getFunnel(): Promise<{ data: FunnelData | null; error: boolean; unauthorized: boolean }> {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant || !['owner', 'admin'].includes(tenant.role)) {
    return { data: null, error: false, unauthorized: true };
  }

  try {
    const { data, error } = await (supabase as any).rpc('get_enrollment_funnel', {
      p_org_id: tenant.organizationId,
      p_months: 12,
    });
    if (error) {
      // RPC missing (draft not yet applied) or any DB error — degrade to null.
      console.error('Enrollment funnel RPC error:', error.message ?? error);
      return { data: null, error: true, unauthorized: false };
    }
    return { data: (data as FunnelData) ?? null, error: false, unauthorized: false };
  } catch (e) {
    console.error('Enrollment funnel fetch threw:', e);
    return { data: null, error: true, unauthorized: false };
  }
}

async function FunnelContent() {
  const { data, error, unauthorized } = await getFunnel();

  if (unauthorized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Access Restricted</p>
          <p className="text-sm text-slate-500 mt-1">Only owners and administrators can view the enrollment funnel.</p>
        </div>
      </div>
    );
  }

  const months = data?.months ?? 12;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enrollment Funnel</h1>
          <p className="text-slate-500">
            Cohort of enrollments created in the last {months} months — stage progression, conversion, and time-in-stage.
          </p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap">
          <Funnel weight="light" className="w-3 h-3 mr-1" />
          Last {months} months
        </Badge>
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <p className="text-sm text-amber-800">
              Funnel analytics are not available yet. This surface depends on a database function
              (<code className="font-mono">get_enrollment_funnel</code>) that has not been deployed to this environment.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top-line metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Cohort Size</CardTitle>
            <Funnel weight="light" className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.cohort_total ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Enrollments started</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Submit Rate</CardTitle>
            <PaperPlaneTilt weight="light" className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{asPercentLabel(data?.conversion.submit_rate ?? null)}</div>
            <p className="text-xs text-slate-500 mt-1">Submitted of started</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Approval Rate</CardTitle>
            <CheckCircle weight="light" className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{asPercentLabel(data?.conversion.approval_rate ?? null)}</div>
            <p className="text-xs text-slate-500 mt-1">Approved of submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Avg Time to Decision</CardTitle>
            <Clock weight="light" className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{asDays(data?.time_in_stage_days.submitted_to_decision.avg ?? null)}</div>
            <p className="text-xs text-slate-500 mt-1">From submission to decision</p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel ladder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Funnel weight="light" className="w-5 h-5" />
            Stage Progression
          </CardTitle>
          <CardDescription>Each bar is scaled to the cohort size; drop-off is measured against the prior stage.</CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.cohort_total ?? 0) > 0 ? (
            <div className="space-y-5">
              {STAGES.map((stage, idx) => {
                const total = data!.stage_reached.started || 1;
                const count = data!.stage_reached[stage.key] ?? 0;
                const widthPercent = pct(count, total);
                const prevCount = idx === 0 ? count : (data!.stage_reached[STAGES[idx - 1].key] ?? 0);
                const dropOff = idx === 0 ? 0 : prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0;
                return (
                  <div key={stage.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        {stage.icon}
                        {stage.label}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-slate-900 font-semibold">{count}</span>
                        <span className="text-slate-400 text-xs">{widthPercent.toFixed(1)}% of cohort</span>
                        {idx > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-red-500">
                            <ArrowDownRight weight="light" className="w-3 h-3" />
                            {dropOff.toFixed(1)}% drop
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${stage.barClass} rounded-full transition-all`} style={{ width: `${widthPercent}%` }} />
                    </div>
                    <p className="text-xs text-slate-400">{stage.description}</p>
                  </div>
                );
              })}

              {/* Terminal outcomes (not on the linear ladder) */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <XCircle weight="light" className="w-4 h-4 text-red-500" /> Rejected
                  </span>
                  <span className="font-semibold text-slate-900">{data!.stage_reached.rejected}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <Prohibit weight="light" className="w-4 h-4 text-slate-400" /> Cancelled
                  </span>
                  <span className="font-semibold text-slate-900">{data!.stage_reached.cancelled}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-500 py-10">No enrollments in the last {months} months.</p>
          )}
        </CardContent>
      </Card>

      {/* Time-in-stage + current status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock weight="light" className="w-5 h-5" />
              Time in Stage
            </CardTitle>
            <CardDescription>Average and median days between stage transitions (rows with both timestamps).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Created → Submitted</span>
                <span className="text-sm text-slate-500">
                  avg <span className="font-semibold text-slate-900">{asDays(data?.time_in_stage_days.created_to_submitted.avg ?? null)}</span>
                  {' · '}median <span className="font-semibold text-slate-900">{asDays(data?.time_in_stage_days.created_to_submitted.median ?? null)}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Submitted → Decision</span>
                <span className="text-sm text-slate-500">
                  avg <span className="font-semibold text-slate-900">{asDays(data?.time_in_stage_days.submitted_to_decision.avg ?? null)}</span>
                  {' · '}median <span className="font-semibold text-slate-900">{asDays(data?.time_in_stage_days.submitted_to_decision.median ?? null)}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hourglass weight="light" className="w-5 h-5" />
              Current Status
            </CardTitle>
            <CardDescription>Live status breakdown of the cohort.</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(data?.current_status_counts ?? {}).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(data!.current_status_counts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">{status.replace(/_/g, ' ')}</Badge>
                      <span className="font-semibold text-slate-900">{count}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">No status data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FunnelSkeleton() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      <div className="h-10 w-96 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
      </div>
      <div className="h-80 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function EnrollmentFunnelPage() {
  return (
    <Suspense fallback={<FunnelSkeleton />}>
      <FunnelContent />
    </Suspense>
  );
}
