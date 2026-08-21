'use client';

import { useState, useEffect } from 'react';
import {
  TrendingDown,
  Loader2,
  RefreshCw,
  Users,
  AlertTriangle,
  Shield,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

interface ChurnData {
  summary: {
    totalMembers: number;
    activeMembers: number;
    cancelledMembers: number;
    overallChurnRate: number;
    churnRate12m: number;
    enrolledThisMonth: number;
    cancelledThisMonth: number;
    topCancelReason: string | null;
  };
  monthlyChurn: Array<{ month: string; enrolled: number; cancelled: number; churn_rate: number }>;
  cancellationReasons: Array<{ reason: string; count: number }>;
  bestRetentionAdvisors: Array<{ row_data: { advisor_id: string; name: string; churn_rate: number; total_members: number; active_members: number; agency_name?: string } }>;
  retentionTrend: Array<{ row_data: { month: string; retention_rate: number; active_count: number; total_count: number } }>;
  atRiskMembers: Array<{
    contact_id: string; contact_name: string | null; contact_email: string | null;
    current_status: string; cancel_count: number; return_count: number;
    top_cancel_reason: string | null;
  }>;
}

const REASON_LABELS: Record<string, string> = {
  cost: 'Cost', coverage_change: 'Coverage Change', moved_state: 'Moved State',
  joined_medicaid: 'Joined Medicaid', joined_employer_plan: 'Employer Plan',
  dissatisfied: 'Dissatisfied', non_payment: 'Non-Payment', aging_out: 'Aging Out',
  life_event: 'Life Event', better_option: 'Better Option', voluntary: 'Voluntary',
  involuntary: 'Involuntary', other: 'Other',
};

export default function ChurnAnalysis() {
  const [data, setData] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const res = await fetch('/api/analytics/churn');
      if (res.ok) setData(await res.json());
      else toast.error('Failed to load churn data');
    } catch { toast.error('Failed to load churn data'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <TrendingDown className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Failed to load churn analysis</p>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" className="mt-4">Try Again</Button>
      </div>
    );
  }

  const { summary, monthlyChurn, cancellationReasons, bestRetentionAdvisors, retentionTrend, atRiskMembers } = data;
  const totalCancellations = cancellationReasons.reduce((s, r) => s + r.count, 0);
  const maxChurnRate = Math.max(...monthlyChurn.map(m => m.churn_rate), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Churn Analysis</h2>
          <p className="text-slate-600 dark:text-slate-400">Member retention, cancellation patterns, and at-risk identification</p>
        </div>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Overall Churn Rate', value: `${summary.overallChurnRate}%`, icon: TrendingDown, color: 'bg-red-500/10', textColor: 'text-red-600 dark:text-red-400', href: '/crm/modules/members' },
          { label: '12-Month Churn', value: `${summary.churnRate12m}%`, icon: TrendingDown, color: 'bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400', href: '/crm/modules/members' },
          { label: 'Active Members', value: summary.activeMembers.toLocaleString(), icon: Users, color: 'bg-emerald-500/10', textColor: 'text-emerald-600 dark:text-emerald-400', href: '/crm/modules/members' },
          { label: 'Cancelled Members', value: summary.cancelledMembers.toLocaleString(), icon: UserX, color: 'bg-slate-500/10', textColor: 'text-slate-600 dark:text-slate-400', href: '/crm/modules/members' },
        ].map((kpi) => (
          <Link key={kpi.label} href={kpi.href} aria-label={kpi.label} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
            <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
              <CardContent className="pt-6">
                <div className={`p-3 rounded-xl ${kpi.color} w-fit mb-3`}>
                  <kpi.icon className={`w-6 h-6 ${kpi.textColor}`} />
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* This Month + Top Reason */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/crm/enrollment" aria-label="Enrolled This Month" className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Enrolled This Month</p>
          <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{summary.enrolledThisMonth}</p>
        </Link>
        <Link href="/crm/modules/members" aria-label="Cancelled This Month" className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:border-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          <p className="text-sm text-red-700 dark:text-red-300">Cancelled This Month</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-200">{summary.cancelledThisMonth}</p>
        </Link>
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">Top Cancellation Reason</p>
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{REASON_LABELS[summary.topCancelReason || ''] || summary.topCancelReason || 'N/A'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Churn Rate */}
        <Card className="glass-card border-slate-200 dark:border-white/10 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Monthly Churn Rate</CardTitle>
            <CardDescription>Cancellations as % of enrollments per month</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyChurn.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-2">
                {monthlyChurn.slice(-12).map((m) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-16 shrink-0">{m.month}</span>
                    <div className="flex-1 h-5 bg-slate-200 dark:bg-slate-800 rounded overflow-hidden">
                      <div
                        className={`h-full rounded transition-all ${m.churn_rate > 20 ? 'bg-red-500' : m.churn_rate > 10 ? 'bg-amber-500' : 'bg-teal-500'}`}
                        style={{ width: `${(m.churn_rate / maxChurnRate) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white w-14 text-right shrink-0">{m.churn_rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancellation Reasons */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Cancellation Reasons</CardTitle>
            <CardDescription>{totalCancellations} in last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {cancellationReasons.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No cancellations</p>
            ) : (
              <div className="space-y-3">
                {cancellationReasons.slice(0, 8).map((r) => (
                  <div key={r.reason} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">{REASON_LABELS[r.reason] || r.reason}</span>
                      <span className="text-slate-900 dark:text-white font-medium">
                        {r.count} ({totalCancellations > 0 ? Math.round((r.count / totalCancellations) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${(r.count / (cancellationReasons[0]?.count || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Retention Advisors */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" /> Best Retention Advisors
            </CardTitle>
            <CardDescription>Lowest churn rates (min 5 members)</CardDescription>
          </CardHeader>
          <CardContent>
            {(bestRetentionAdvisors || []).length === 0 ? (
              <p className="text-slate-500 text-center py-8">No data</p>
            ) : (
              <div className="space-y-3">
                {bestRetentionAdvisors.map((a, idx) => {
                  const d = a.row_data || a;
                  return (
                    <Link key={(d as { advisor_id: string }).advisor_id || idx} href="/crm/settings/team" aria-label={(d as { name: string }).name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate">{(d as { name: string }).name}</p>
                        <p className="text-xs text-slate-500">{(d as { active_members: number }).active_members} active / {(d as { total_members: number }).total_members} total</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{(d as { churn_rate: number }).churn_rate}%</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* At-Risk Members */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> At-Risk Members
            </CardTitle>
            <CardDescription>Re-enrolled members with prior cancellations</CardDescription>
          </CardHeader>
          <CardContent>
            {atRiskMembers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No at-risk members identified</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {atRiskMembers.map((m) => (
                  <Link key={m.contact_id} href={`/crm/r/${m.contact_id}`} aria-label={m.contact_name || m.contact_email || 'Member'} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50">
                    <div>
                      <p className="text-sm text-slate-900 dark:text-white">{m.contact_name || m.contact_email || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">
                        {m.cancel_count} cancellation{m.cancel_count !== 1 ? 's' : ''}
                        {m.return_count > 0 ? `, ${m.return_count} return${m.return_count !== 1 ? 's' : ''}` : ''}
                        {m.top_cancel_reason ? ` · ${REASON_LABELS[m.top_cancel_reason] || m.top_cancel_reason}` : ''}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                      At Risk
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
