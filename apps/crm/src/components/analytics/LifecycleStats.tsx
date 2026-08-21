'use client';

import { useState, useEffect } from 'react';
import {
  HeartPulse,
  UserPlus,
  UserMinus,
  RotateCcw,
  Loader2,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

interface LifecycleData {
  summary: {
    totalTrackedMembers: number;
    enrolledThisMonth: number;
    cancelledThisMonth: number;
    totalReturned: number;
    churnRate12m: number;
    topCancelReason: string | null;
  };
  monthlyTrends: Array<{ month: string; enrolled: number; cancelled: number; returned: number; paused: number }>;
  cancellationReasons: Array<{ reason: string; count: number }>;
  byPlanType: Array<{ plan_type: string; enrolled: number; cancelled: number }>;
  recentEvents: Array<{
    id: string;
    event_type: string;
    event_date: string;
    reason: string | null;
    plan_type: string | null;
    contact: { id: string; title: string | null; email: string | null } | null;
    advisor: { id: string; first_name: string; last_name: string } | null;
  }>;
}

const REASON_LABELS: Record<string, string> = {
  cost: 'Cost',
  coverage_change: 'Coverage Change',
  moved_state: 'Moved State',
  joined_medicaid: 'Joined Medicaid',
  joined_employer_plan: 'Employer Plan',
  dissatisfied: 'Dissatisfied',
  non_payment: 'Non-Payment',
  aging_out: 'Aging Out',
  life_event: 'Life Event',
  better_option: 'Better Option',
  voluntary: 'Voluntary',
  involuntary: 'Involuntary',
  other: 'Other',
};

const EVENT_COLORS: Record<string, string> = {
  enrolled: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  returned: 'bg-blue-500',
  paused: 'bg-amber-500',
};

const EVENT_LABELS: Record<string, string> = {
  enrolled: 'Enrolled',
  cancelled: 'Cancelled',
  returned: 'Returned',
  paused: 'Paused',
};

export default function LifecycleStats() {
  const [data, setData] = useState<LifecycleData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const res = await fetch('/api/analytics/lifecycle');
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error('Failed to load lifecycle data');
      }
    } catch {
      toast.error('Failed to load lifecycle data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <HeartPulse className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Failed to load lifecycle stats</p>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" className="mt-4">Try Again</Button>
      </div>
    );
  }

  const { summary, monthlyTrends, cancellationReasons, byPlanType, recentEvents } = data;
  const totalCancellations = cancellationReasons.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Lifecycle Stats</h2>
          <p className="text-slate-600 dark:text-slate-400">Member enrollment, cancellation, and retention trends</p>
        </div>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { href: '/crm/modules/members', label: 'Tracked Members', value: summary.totalTrackedMembers.toLocaleString(), icon: HeartPulse, bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400' },
          { href: '/crm/enrollment', label: 'Enrolled This Month', value: summary.enrolledThisMonth, icon: UserPlus, bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
          { href: '/crm/modules/members', label: 'Cancelled This Month', value: summary.cancelledThisMonth, icon: UserMinus, bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
          { href: '/crm/modules/members', label: 'Total Returned', value: summary.totalReturned, icon: RotateCcw, bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
          { href: '/crm/analytics?tab=churn', label: '12-Month Churn Rate', value: `${summary.churnRate12m}%`, icon: TrendingDown, bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
        ].map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            aria-label={kpi.label}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
              <CardContent className="pt-6">
                <div className={`p-3 rounded-xl ${kpi.bg} w-fit mb-3`}>
                  <kpi.icon className={`w-6 h-6 ${kpi.text}`} />
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trends */}
        <Card className="glass-card border-slate-200 dark:border-white/10 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Monthly Trends</CardTitle>
            <CardDescription>Enrollments vs cancellations over time</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrends.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No lifecycle events recorded yet</p>
            ) : (
              <div className="space-y-2">
                {/* Legend */}
                <div className="flex gap-4 text-xs mb-4">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Enrolled</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Cancelled</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Returned</span>
                </div>
                {monthlyTrends.slice(-12).map((m) => {
                  const maxVal = Math.max(m.enrolled, m.cancelled, m.returned, 1);
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16 shrink-0">{m.month}</span>
                      <div className="flex-1 flex gap-1 items-center">
                        <div className="h-5 bg-emerald-500/80 rounded" style={{ width: `${(m.enrolled / maxVal) * 100}%`, minWidth: m.enrolled > 0 ? 4 : 0 }} />
                        <div className="h-5 bg-red-500/80 rounded" style={{ width: `${(m.cancelled / maxVal) * 100}%`, minWidth: m.cancelled > 0 ? 4 : 0 }} />
                        <div className="h-5 bg-blue-500/80 rounded" style={{ width: `${(m.returned / maxVal) * 100}%`, minWidth: m.returned > 0 ? 4 : 0 }} />
                      </div>
                      <span className="text-xs text-slate-400 w-24 text-right shrink-0">
                        +{m.enrolled} / -{m.cancelled}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancellation Reasons */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Cancellation Reasons</CardTitle>
            <CardDescription>{totalCancellations} total cancellations</CardDescription>
          </CardHeader>
          <CardContent>
            {cancellationReasons.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No cancellations recorded</p>
            ) : (
              <div className="space-y-3">
                {cancellationReasons.slice(0, 8).map((r) => (
                  <div key={r.reason} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">{REASON_LABELS[r.reason] || r.reason}</span>
                      <span className="text-slate-900 dark:text-white font-medium">{r.count}</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/70 rounded-full"
                        style={{ width: `${(r.count / (cancellationReasons[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Plan Type */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">By Plan Type</CardTitle>
            <CardDescription>Lifecycle events by coverage type</CardDescription>
          </CardHeader>
          <CardContent>
            {byPlanType.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-4">
                {byPlanType.map((pt) => (
                  <div key={pt.plan_type} className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                    <span className="text-slate-900 dark:text-white font-medium capitalize">{pt.plan_type}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <ArrowUpRight className="w-3 h-3" /> {pt.enrolled}
                      </span>
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <ArrowDownRight className="w-3 h-3" /> {pt.cancelled}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Recent Events</CardTitle>
            <CardDescription>Latest lifecycle changes</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No events yet</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recentEvents.map((e) => {
                  const row = (
                    <>
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${EVENT_COLORS[e.event_type] || 'bg-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate">
                          {e.contact?.title || e.contact?.email || 'Unknown'}{' '}
                          <span className="text-slate-500">— {EVENT_LABELS[e.event_type] || e.event_type}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {e.event_date}{e.reason ? ` · ${REASON_LABELS[e.reason] || e.reason}` : ''}
                          {e.plan_type ? ` · ${e.plan_type}` : ''}
                        </p>
                      </div>
                    </>
                  );
                  const className = 'flex items-start gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50';
                  return e.contact?.id ? (
                    <Link key={e.id} href={`/crm/r/${e.contact.id}`} className={className} aria-label={e.contact.title || e.contact.email || 'Record'}>
                      {row}
                    </Link>
                  ) : (
                    <div key={e.id} className={className}>{row}</div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
