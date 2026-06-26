import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import {
  BarChart3,
  Send,
  CheckCircle,
  Layers,
  CalendarRange,
  TrendingUp,
} from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

// ---------------------------------------------------------------------------
// Enrollment analytics (apps/admin /analytics/enrollments).
//
// Server component. Owner/admin gate via getActiveTenant().role (mirrors
// analytics/funnel/page.tsx and analytics/actuarial/page.tsx). Pulls the
// enrollment cohort directly from the org-scoped `enrollments` table through
// the SSR cookie client (RLS enforces tenant isolation) and aggregates in
// memory: counts by current status, counts by created month, and the
// submit / approval conversion rates. Degrades gracefully on error.
// ---------------------------------------------------------------------------

const MONTHS = 12;

interface EnrollmentRow {
  status: string | null;
  created_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  total_monthly_cost: number | null;
}

interface MonthBucket {
  key: string; // YYYY-MM
  label: string; // e.g. "Jun 2026"
  count: number;
}

interface EnrollmentAnalytics {
  total: number;
  statusCounts: Record<string, number>;
  monthly: MonthBucket[];
  submitted: number;
  approved: number;
  submitRate: number | null;
  approvalRate: number | null;
  premiumMonthly: number;
}

function asPercentLabel(rate: number | null): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function asCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

// Build the ordered list of month buckets for the trailing MONTHS window.
function buildMonthBuckets(): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const now = new Date();
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    buckets.push({ key, label, count: 0 });
  }
  return buckets;
}

async function getAnalytics(): Promise<{
  data: EnrollmentAnalytics | null;
  error: boolean;
  unauthorized: boolean;
}> {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant || !['owner', 'admin'].includes(tenant.role)) {
    return { data: null, error: false, unauthorized: true };
  }

  // Cohort window: enrollments created in the trailing MONTHS months.
  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  try {
    const { data, error } = await (supabase as any)
      .from('enrollments')
      .select('status, created_at, submitted_at, approved_at, total_monthly_cost')
      .eq('organization_id', tenant.organizationId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(20000);

    if (error) {
      console.error('Enrollment analytics fetch error:', error.message ?? error);
      return { data: null, error: true, unauthorized: false };
    }

    const rows = (data ?? []) as EnrollmentRow[];

    const buckets = buildMonthBuckets();
    const bucketByKey = new Map(buckets.map((b) => [b.key, b]));
    const statusCounts: Record<string, number> = {};
    let submitted = 0;
    let approved = 0;
    let premiumMonthly = 0;

    for (const row of rows) {
      const status = (row.status ?? 'unknown').toLowerCase();
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;

      if (row.submitted_at) submitted += 1;
      if (row.approved_at || status === 'active' || status === 'approved') approved += 1;
      if (typeof row.total_monthly_cost === 'number') premiumMonthly += row.total_monthly_cost;

      if (row.created_at) {
        const key = row.created_at.slice(0, 7); // YYYY-MM
        const bucket = bucketByKey.get(key);
        if (bucket) bucket.count += 1;
      }
    }

    const total = rows.length;
    const submitRate = total > 0 ? submitted / total : null;
    const approvalRate = submitted > 0 ? approved / submitted : null;

    return {
      data: {
        total,
        statusCounts,
        monthly: buckets,
        submitted,
        approved,
        submitRate,
        approvalRate,
        premiumMonthly,
      },
      error: false,
      unauthorized: false,
    };
  } catch (e) {
    console.error('Enrollment analytics fetch threw:', e);
    return { data: null, error: true, unauthorized: false };
  }
}

async function EnrollmentsContent() {
  const { data, error, unauthorized } = await getAnalytics();

  if (unauthorized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Access Restricted</p>
          <p className="text-sm text-slate-500 mt-1">Only owners and administrators can view enrollment analytics.</p>
        </div>
      </div>
    );
  }

  const maxMonthly = Math.max(1, ...(data?.monthly ?? []).map((m) => m.count));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enrollment Analytics</h1>
          <p className="text-slate-500">
            Enrollments created in the last {MONTHS} months — volume by month, status breakdown, and conversion.
          </p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap">
          <CalendarRange className="w-3 h-3 mr-1" />
          Last {MONTHS} months
        </Badge>
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <p className="text-sm text-amber-800">
              Unable to load enrollment analytics right now. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top-line metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Enrollments</CardTitle>
            <Layers className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Created in window</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Submit Rate</CardTitle>
            <Send className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{asPercentLabel(data?.submitRate ?? null)}</div>
            <p className="text-xs text-slate-500 mt-1">{data?.submitted ?? 0} submitted of {data?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Approval Rate</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{asPercentLabel(data?.approvalRate ?? null)}</div>
            <p className="text-xs text-slate-500 mt-1">{data?.approved ?? 0} approved of {data?.submitted ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Monthly Premium</CardTitle>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{asCurrency(data?.premiumMonthly ?? 0)}</div>
            <p className="text-xs text-slate-500 mt-1">Total monthly cost in cohort</p>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments by month */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Enrollments by Month
          </CardTitle>
          <CardDescription>Volume of enrollments created each month over the trailing {MONTHS}-month window.</CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.total ?? 0) > 0 ? (
            <div className="space-y-4">
              {data!.monthly.map((m) => {
                const widthPercent = (m.count / maxMonthly) * 100;
                return (
                  <div key={m.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{m.label}</span>
                      <span className="text-slate-900 font-semibold">{m.count}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-10">No enrollments in the last {MONTHS} months.</p>
          )}
        </CardContent>
      </Card>

      {/* Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Status Breakdown
          </CardTitle>
          <CardDescription>Current status distribution of the cohort.</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(data?.statusCounts ?? {}).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(data!.statusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const widthPercent = data!.total > 0 ? (count / data!.total) * 100 : 0;
                  return (
                    <div key={status} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline" className="capitalize">{status.replace(/_/g, ' ')}</Badge>
                        <span className="flex items-center gap-3">
                          <span className="text-slate-900 font-semibold">{count}</span>
                          <span className="text-slate-400 text-xs">{widthPercent.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-400 rounded-full transition-all"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">No status data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EnrollmentsSkeleton() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      <div className="h-10 w-96 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
      </div>
      <div className="h-80 bg-slate-100 rounded-xl" />
      <div className="h-64 bg-slate-100 rounded-xl" />
    </div>
  );
}

export default function EnrollmentAnalyticsPage() {
  return (
    <Suspense fallback={<EnrollmentsSkeleton />}>
      <EnrollmentsContent />
    </Suspense>
  );
}
