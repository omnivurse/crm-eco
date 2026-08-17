'use client';

import { useState, useEffect } from 'react';
import {
  UserCog,
  Loader2,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Users,
  Award,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

interface AdvisorData {
  orgAnalytics: {
    summary?: {
      total_commissions: number; paid_amount: number; pending_amount: number;
      total_enrollments: number; active_advisors: number;
    };
    monthly?: Array<{ month: string; total_commissions: number; total_enrollments: number; active_advisors: number }>;
    by_product?: Array<{ product_type: string; total_commissions: number; total_enrollments: number }>;
  };
  topByEnrollments: Array<{ row_data: { advisor_id: string; name: string; total_enrollments: number; agency_name?: string } }>;
  topByRevenue: Array<{ row_data: { advisor_id: string; name: string; total_commissions: number; agency_name?: string } }>;
  retentionTrend: Array<{ row_data: { month: string; retention_rate: number; active_count: number; total_count: number } }>;
  advisorStatusBreakdown: Array<{ status: string; count: number }>;
  tierDistribution: Array<{ tier: string; count: number }>;
  growth: {
    current_month?: { commissions: number; enrollments: number };
    previous_month?: { commissions: number; enrollments: number };
    growth_pct?: { commissions: number; enrollments: number };
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-slate-400',
  pending: 'bg-amber-500',
  suspended: 'bg-red-500',
  terminated: 'bg-red-700',
};

export default function AdvisorAnalytics() {
  const [data, setData] = useState<AdvisorData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const res = await fetch('/api/analytics/advisor-summary');
      if (res.ok) setData(await res.json());
      else toast.error('Failed to load advisor analytics');
    } catch { toast.error('Failed to load advisor analytics'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <UserCog className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Failed to load advisor analytics</p>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" className="mt-4">Try Again</Button>
      </div>
    );
  }

  const summary = data.orgAnalytics?.summary;
  const growth = data.growth?.growth_pct;
  const safeEnrollments = Array.isArray(data.topByEnrollments) ? data.topByEnrollments : [];
  const safeRevenue = Array.isArray(data.topByRevenue) ? data.topByRevenue : [];
  const safeRetention = Array.isArray(data.retentionTrend) ? data.retentionTrend : [];
  const safeStatusBreakdown = Array.isArray(data.advisorStatusBreakdown) ? data.advisorStatusBreakdown : [];
  const safeTierDistribution = Array.isArray(data.tierDistribution) ? data.tierDistribution : [];
  const totalAdvisors = safeStatusBreakdown.reduce((s, a) => s + a.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Advisor Analytics</h2>
          <p className="text-slate-600 dark:text-slate-400">Performance, commissions, and team composition</p>
        </div>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/crm/commissions" aria-label="Total Commissions" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-emerald-500/10"><DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
              {growth?.commissions !== undefined && (
                <span className={`flex items-center gap-1 text-sm ${growth.commissions >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {growth.commissions >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {Math.abs(growth.commissions).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">{formatCurrency(summary?.total_commissions || 0)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Total Commissions</p>
          </CardContent>
        </Card>
        </Link>
        <Link href="/crm/enrollment" aria-label="Total Enrollments" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-teal-500/10"><TrendingUp className="w-6 h-6 text-teal-600 dark:text-teal-400" /></div>
              {growth?.enrollments !== undefined && (
                <span className={`flex items-center gap-1 text-sm ${growth.enrollments >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {growth.enrollments >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {Math.abs(growth.enrollments).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">{(summary?.total_enrollments || 0).toLocaleString()}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Total Enrollments</p>
          </CardContent>
        </Card>
        </Link>
        <Link href="/crm/settings/team" aria-label="Active Advisors" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-blue-500/10"><Users className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">{summary?.active_advisors || 0}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Active Advisors</p>
          </CardContent>
        </Card>
        </Link>
        <Link href="/crm/commissions?tab=transactions&status=pending" aria-label="Pending Payouts" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-all h-full">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-amber-500/10"><DollarSign className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">{formatCurrency(summary?.pending_amount || 0)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Pending Payouts</p>
          </CardContent>
        </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by Enrollments */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Top Advisors — Enrollments</CardTitle>
            <CardDescription>Ranked by total enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            {safeEnrollments.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No data</p>
            ) : (
              <div className="space-y-3">
                {safeEnrollments.map((a, idx) => {
                  const d = a.row_data || a;
                  return (
                    <Link key={(d as { advisor_id: string }).advisor_id || idx} href="/crm/settings/team" aria-label={(d as { name: string }).name} className="flex items-center gap-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 px-1 py-0.5">
                      <span className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate">{(d as { name: string }).name}</p>
                        {(d as { agency_name?: string }).agency_name && <p className="text-xs text-slate-500 truncate">{(d as { agency_name: string }).agency_name}</p>}
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{(d as { total_enrollments: number }).total_enrollments}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top by Revenue */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Top Advisors — Revenue</CardTitle>
            <CardDescription>Ranked by total commissions</CardDescription>
          </CardHeader>
          <CardContent>
            {safeRevenue.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No data</p>
            ) : (
              <div className="space-y-3">
                {safeRevenue.map((a, idx) => {
                  const d = a.row_data || a;
                  return (
                    <Link key={(d as { advisor_id: string }).advisor_id || idx} href="/crm/settings/team" aria-label={(d as { name: string }).name} className="flex items-center gap-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 px-1 py-0.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate">{(d as { name: string }).name}</p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency((d as { total_commissions: number }).total_commissions)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Advisor Status */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Advisor Status</CardTitle>
            <CardDescription>{totalAdvisors} total advisors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {safeStatusBreakdown.map((s) => (
                <div key={s.status} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${STATUS_COLORS[s.status] || 'bg-slate-400'}`} />
                  <span className="flex-1 text-sm text-slate-600 dark:text-slate-400 capitalize">{s.status}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Commission Tiers</CardTitle>
            <CardDescription>Active advisor distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {safeTierDistribution.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No tier data</p>
            ) : (
              <div className="space-y-3">
                {safeTierDistribution.map((t) => (
                  <div key={t.tier} className="flex items-center gap-3">
                    <Award className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="flex-1 text-sm text-slate-600 dark:text-slate-400">{t.tier}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{t.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Retention Trend */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Monthly Retention</CardTitle>
            <CardDescription>Member retention rate trend</CardDescription>
          </CardHeader>
          <CardContent>
            {safeRetention.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No retention data</p>
            ) : (
              <div className="space-y-2">
                {safeRetention.map((r) => {
                  const d = r.row_data || r;
                  const rate = (d as { retention_rate: number }).retention_rate;
                  return (
                    <div key={(d as { month: string }).month} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{(d as { month: string }).month}</span>
                        <span className="text-slate-900 dark:text-white font-medium">{rate}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
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
