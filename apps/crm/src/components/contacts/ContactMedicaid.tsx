'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Loader2,
  RefreshCw,
  Users,
  ArrowRightLeft,
  MapPin,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

interface MedicaidData {
  summary: {
    totalMedicaidMembers: number;
    activeMedicaid: number;
    formerMedicaid: number;
    transitioningFromMedicaid: number;
    newMedicaidThisMonth: number;
  };
  stateBreakdown: Array<{
    state: string;
    total: number;
    active: number;
    former: number;
    transitioning: number;
  }>;
  transitioningMembers: Array<{
    id: string;
    title: string | null;
    email: string | null;
    medicaid_state: string | null;
    medicaid_start_date: string | null;
    medicaid_end_date: string | null;
    status: string | null;
  }>;
  monthlyTrends: Array<{ month: string; enrolled: number; cancelled: number }>;
  topAdvisors: Array<{ advisor_id: string; name: string; count: number }>;
}

export default function ContactMedicaid() {
  const [data, setData] = useState<MedicaidData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const res = await fetch('/api/analytics/medicaid');
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error('Failed to load Medicaid data');
      }
    } catch {
      toast.error('Failed to load Medicaid data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

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
        <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Failed to load Medicaid data</p>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  const { summary, stateBreakdown, transitioningMembers, monthlyTrends, topAdvisors } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Medicaid Tracking</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Medicaid member status, state breakdown, and transition monitoring
          </p>
        </div>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-indigo-500/10 w-fit mb-3">
              <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {summary.totalMedicaidMembers.toLocaleString()}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Total Medicaid</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-emerald-500/10 w-fit mb-3">
              <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {summary.activeMedicaid.toLocaleString()}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Active Medicaid</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-amber-500/10 w-fit mb-3">
              <ArrowRightLeft className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {summary.transitioningFromMedicaid.toLocaleString()}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Transitioning</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-slate-500/10 w-fit mb-3">
              <Users className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {summary.formerMedicaid.toLocaleString()}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Former Medicaid</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-teal-500/10 w-fit mb-3">
              <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {summary.newMedicaidThisMonth}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">New This Month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* State Breakdown */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">State Breakdown</CardTitle>
            <CardDescription>Medicaid members by state</CardDescription>
          </CardHeader>
          <CardContent>
            {stateBreakdown.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No state data available</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {stateBreakdown.map((s) => (
                  <div
                    key={s.state}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900 dark:text-white">{s.state}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        {s.total.toLocaleString()} total
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {s.active} active
                      </span>
                      {s.transitioning > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {s.transitioning} transitioning
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trends */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Monthly Trends</CardTitle>
            <CardDescription>Medicaid enrollment and disenrollment</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrends.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No trend data yet</p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-4 text-xs mb-4">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-500" /> Enrolled
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-500" /> Cancelled
                  </span>
                </div>
                {monthlyTrends.slice(-12).map((m) => {
                  const maxVal = Math.max(m.enrolled, m.cancelled, 1);
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16 shrink-0">{m.month}</span>
                      <div className="flex-1 flex gap-1 items-center">
                        <div
                          className="h-5 bg-emerald-500/80 rounded"
                          style={{ width: `${(m.enrolled / maxVal) * 100}%`, minWidth: m.enrolled > 0 ? 4 : 0 }}
                        />
                        <div
                          className="h-5 bg-red-500/80 rounded"
                          style={{ width: `${(m.cancelled / maxVal) * 100}%`, minWidth: m.cancelled > 0 ? 4 : 0 }}
                        />
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
      </div>

      {/* Transitioning Members */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Transitioning Members
          </CardTitle>
          <CardDescription>
            Members with Medicaid coverage ending within 90 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transitioningMembers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No members currently transitioning</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">
                      Name
                    </th>
                    <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">
                      State
                    </th>
                    <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">
                      Start Date
                    </th>
                    <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">
                      End Date
                    </th>
                    <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transitioningMembers.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-2.5 px-3 text-slate-900 dark:text-white">
                        {m.title || m.email || 'Unknown'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {m.medicaid_state || '--'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {m.medicaid_start_date || '--'}
                      </td>
                      <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400 font-medium">
                        {m.medicaid_end_date || '--'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          {m.status || 'active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Advisors */}
      {topAdvisors.length > 0 && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Top Advisors</CardTitle>
            <CardDescription>Advisors with the most Medicaid enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topAdvisors.map((a, i) => (
                <div
                  key={a.advisor_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium">{a.name}</span>
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {a.count} enrollments
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
