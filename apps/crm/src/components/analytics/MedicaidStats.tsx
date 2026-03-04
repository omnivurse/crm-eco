'use client';

import { useState, useEffect } from 'react';
import {
  ShieldPlus,
  MapPin,
  ArrowRightLeft,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
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
  stateBreakdown: Array<{ state: string; total: number; active: number; transitioning: number }>;
  transitioningMembers: Array<{
    id: string; title: string | null; email: string | null;
    medicaid_state: string | null; medicaid_start_date: string | null;
    medicaid_end_date: string | null; status: string | null;
  }>;
  monthlyTrends: Array<{ month: string; enrolled: number; cancelled: number }>;
  topAdvisors: Array<{ advisor_id: string; name: string; count: number }>;
}

export default function MedicaidStats() {
  const [data, setData] = useState<MedicaidData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const res = await fetch('/api/analytics/medicaid');
      if (res.ok) setData(await res.json());
      else toast.error('Failed to load Medicaid data');
    } catch { toast.error('Failed to load Medicaid data'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <ShieldPlus className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Failed to load Medicaid stats</p>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" className="mt-4">Try Again</Button>
      </div>
    );
  }

  const { summary, stateBreakdown, transitioningMembers, monthlyTrends, topAdvisors } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Medicaid Stats</h2>
          <p className="text-slate-600 dark:text-slate-400">Medicaid membership tracking and transition analysis</p>
        </div>
        <Button onClick={() => { setLoading(true); fetchData(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Medicaid', value: summary.totalMedicaidMembers, icon: ShieldPlus, color: 'violet' },
          { label: 'Active Medicaid', value: summary.activeMedicaid, icon: Users, color: 'emerald' },
          { label: 'Former Medicaid', value: summary.formerMedicaid, icon: Users, color: 'slate' },
          { label: 'Transitioning', value: summary.transitioningFromMedicaid, icon: ArrowRightLeft, color: 'amber' },
          { label: 'New This Month', value: summary.newMedicaidThisMonth, icon: UserPlus, color: 'blue' },
        ].map((kpi) => {
          const colorMap: Record<string, { bg: string; text: string }> = {
            violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
            emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
            slate: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400' },
            amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
            blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
          };
          const c = colorMap[kpi.color];
          return (
            <Card key={kpi.label} className="glass-card border-slate-200 dark:border-white/10">
              <CardContent className="pt-6">
                <div className={`p-3 rounded-xl ${c.bg} w-fit mb-3`}>
                  <kpi.icon className={`w-6 h-6 ${c.text}`} />
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{kpi.value.toLocaleString()}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* State Breakdown */}
        <Card className="glass-card border-slate-200 dark:border-white/10 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">By State</CardTitle>
            <CardDescription>Medicaid members by state</CardDescription>
          </CardHeader>
          <CardContent>
            {stateBreakdown.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No state data available</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {stateBreakdown.map((s) => (
                  <div key={s.state} className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900 dark:text-white">{s.state}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{s.total}</span>
                      {s.transitioning > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">({s.transitioning} trans.)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Monthly Trend</CardTitle>
            <CardDescription>Medicaid enrollments & cancellations</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrends.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No trend data</p>
            ) : (
              <div className="space-y-2">
                {monthlyTrends.slice(-12).map((m) => (
                  <div key={m.month} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 w-16">{m.month}</span>
                    <div className="flex gap-3">
                      <span className="text-emerald-600 dark:text-emerald-400">+{m.enrolled}</span>
                      <span className="text-red-600 dark:text-red-400">-{m.cancelled}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transitioning Members */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Transitioning Members</CardTitle>
            <CardDescription>Members whose Medicaid ended in the last 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            {transitioningMembers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No members currently transitioning</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {transitioningMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50">
                    <div>
                      <p className="text-sm text-slate-900 dark:text-white">{m.title || m.email || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{m.medicaid_state} · Ended {m.medicaid_end_date}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Transitioning
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Advisors */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Top Advisors — Medicaid Enrollments</CardTitle>
            <CardDescription>Advisors with most Medicaid enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            {topAdvisors.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No advisor data</p>
            ) : (
              <div className="space-y-3">
                {topAdvisors.map((a, idx) => (
                  <div key={a.advisor_id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm text-slate-900 dark:text-white truncate">{a.name}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{a.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
