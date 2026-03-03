'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Trophy,
  Target,
  Building2,
  Shield,
  Heart,
  BarChart3,
  Crown,
  Download,
  Activity,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface KpiData {
  month: string;
  revenue: {
    total_commission: number;
    paid_commission: number;
    pending_commission: number;
    avg_per_advisor: number;
  };
  production: {
    total_policies: number;
    total_advisors: number;
    health_share_policies: number;
    insurance_policies: number;
  };
  growth: {
    commission_growth_pct: number;
    policy_growth_pct: number;
    advisor_growth_pct: number;
  };
  top_advisor: {
    advisor_id: string;
    name: string;
    score: number;
    commissions: number;
    tier: string;
  } | null;
  capacity_split: {
    health_share_commission: number;
    insurance_commission: number;
    health_share_ratio: number;
    insurance_ratio: number;
  };
  agency_breakdown: Array<{
    agency_id: string;
    agency_name: string;
    total_commission: number;
    total_policies: number;
    advisor_count: number;
  }>;
  franchise_breakdown: Array<{
    child_org_id: string;
    child_org_name: string;
    total_commission: number;
    total_policies: number;
    total_advisors: number;
  }>;
}

interface SystemEvent {
  id: string;
  event_type: string;
  entity_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function GrowthBadge({ value, label }: { value: number; label: string }) {
  if (value === 0) return <span className="text-xs text-slate-400">{label}: --</span>;
  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400'
      }`}
    >
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value)}% {label}
    </span>
  );
}

const TIER_COLORS: Record<string, string> = {
  bronze: 'text-orange-600 dark:text-orange-400',
  silver: 'text-slate-500 dark:text-slate-300',
  gold: 'text-amber-600 dark:text-amber-400',
  platinum: 'text-violet-600 dark:text-violet-400',
  elite: 'text-rose-600 dark:text-rose-400',
};

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  commission_created: { label: 'Commission', color: 'bg-emerald-500' },
  payout_batch_created: { label: 'Batch Created', color: 'bg-blue-500' },
  payout_batch_approved: { label: 'Batch Approved', color: 'bg-violet-500' },
  payout_completed: { label: 'Payout Sent', color: 'bg-teal-500' },
  payout_failed: { label: 'Payout Failed', color: 'bg-red-500' },
  ranking_updated: { label: 'Ranking Update', color: 'bg-amber-500' },
  achievement_earned: { label: 'Achievement', color: 'bg-rose-500' },
  agency_updated: { label: 'Agency Update', color: 'bg-indigo-500' },
  franchise_event: { label: 'Franchise', color: 'bg-slate-500' },
  export_completed: { label: 'Export', color: 'bg-cyan-500' },
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ExecutiveDashboardPage() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const kpiParams = new URLSearchParams();
      if (selectedMonth) kpiParams.set('month', `${selectedMonth}-01`);

      const [kpiRes, eventsRes] = await Promise.all([
        fetch(`/api/executive/kpis?${kpiParams}`),
        fetch('/api/executive/events?limit=15'),
      ]);

      if (kpiRes.ok) {
        setKpis(await kpiRes.json());
      } else if (kpiRes.status === 403) {
        toast.error('Access denied — admin only');
      }

      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setEvents(evData.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch executive data:', error);
      toast.error('Failed to load executive dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleExport(exportType: string) {
    setExporting(true);
    try {
      const res = await fetch('/api/executive/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          export_type: exportType,
          month: selectedMonth ? `${selectedMonth}-01` : undefined,
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      toast.success(`Export completed: ${data.row_count} rows`);
    } catch {
      toast.error('Failed to generate export');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="glass-card border-slate-200 dark:border-white/10 max-w-md">
          <CardContent className="py-12 text-center">
            <Crown className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              Executive Dashboard
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This dashboard requires admin access. KPI data is generated from nightly analytics
              refreshes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rev = kpis.revenue;
  const prod = kpis.production;
  const growth = kpis.growth;
  const cap = kpis.capacity_split;
  const topAdvisor = kpis.top_advisor;
  const agencies = kpis.agency_breakdown;
  const franchise = kpis.franchise_breakdown;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Crown className="w-7 h-7 text-amber-500" />
            Executive Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            C-suite KPIs — materialized view only, sub-500ms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <Select
            value="full"
            onValueChange={(v) => handleExport(v)}
          >
            <SelectTrigger className="w-40 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-sm h-9" disabled={exporting}>
              <div className="flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                {exporting ? 'Exporting...' : 'Export Data'}
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full Export</SelectItem>
              <SelectItem value="commissions">Commissions</SelectItem>
              <SelectItem value="rankings">Rankings</SelectItem>
              <SelectItem value="agencies">Agencies</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(rev.total_commission)}
                </p>
                <GrowthBadge value={growth.commission_growth_pct} label="MoM" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Policies</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {prod.total_policies.toLocaleString()}
                </p>
                <GrowthBadge value={growth.policy_growth_pct} label="MoM" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10">
                <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Active Advisors</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {prod.total_advisors.toLocaleString()}
                </p>
                <GrowthBadge value={growth.advisor_growth_pct} label="MoM" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Avg / Advisor</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(rev.avg_per_advisor)}
                </p>
                <span className="text-xs text-slate-400">
                  {formatCurrency(rev.paid_commission)} paid
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Capacity Split */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white">
              Capacity Split
            </CardTitle>
            <CardDescription>Revenue by product type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Visual bar */}
              <div className="h-4 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700">
                {cap.insurance_ratio > 0 && (
                  <div
                    className="bg-blue-500 transition-all duration-500"
                    style={{ width: `${cap.insurance_ratio}%` }}
                  />
                )}
                {cap.health_share_ratio > 0 && (
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{ width: `${cap.health_share_ratio}%` }}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Insurance</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(cap.insurance_commission)}
                    </p>
                    <p className="text-[10px] text-blue-500">{cap.insurance_ratio}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <Heart className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Health Share</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(cap.health_share_commission)}
                    </p>
                    <p className="text-[10px] text-emerald-500">{cap.health_share_ratio}%</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Advisor */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Top Advisor
            </CardTitle>
            <CardDescription>Highest production score this month</CardDescription>
          </CardHeader>
          <CardContent>
            {topAdvisor ? (
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/25">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg text-slate-900 dark:text-white">
                    {topAdvisor.name}
                  </p>
                  <p className={`text-sm font-semibold ${TIER_COLORS[topAdvisor.tier] || 'text-slate-500'}`}>
                    {topAdvisor.tier?.charAt(0).toUpperCase() + topAdvisor.tier?.slice(1)} Tier
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {Math.round(topAdvisor.score).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">Score</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(topAdvisor.commissions)}
                    </p>
                    <p className="text-[10px] text-slate-400">Commissions</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No rankings data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-500" />
              Live Activity
            </CardTitle>
            <CardDescription>Recent system events</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.map((evt) => {
                  const config = EVENT_LABELS[evt.event_type] || {
                    label: evt.event_type,
                    color: 'bg-slate-500',
                  };
                  return (
                    <div
                      key={evt.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${config.color} flex-shrink-0`} />
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                        {config.label}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">
                        {new Date(evt.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No events yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agency Breakdown */}
      {agencies.length > 0 && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Agency Performance
            </CardTitle>
            <CardDescription>Top agencies by production</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Header */}
            <div className="hidden md:grid md:grid-cols-[1fr_7rem_6rem_5rem] gap-4 px-3 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
              <span>Agency</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Policies</span>
              <span className="text-right">Advisors</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {agencies.map((ag, idx) => {
                const maxRevenue = agencies[0]?.total_commission || 1;
                const barWidth = (ag.total_commission / maxRevenue) * 100;
                return (
                  <div
                    key={ag.agency_id}
                    className="relative flex items-center md:grid md:grid-cols-[1fr_7rem_6rem_5rem] gap-4 px-3 py-3"
                  >
                    {/* Background bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-indigo-500/5 rounded-r"
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="relative flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}</span>
                      <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                        {ag.agency_name}
                      </p>
                    </div>
                    <p className="relative text-right font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(ag.total_commission)}
                    </p>
                    <p className="relative text-right text-sm text-slate-600 dark:text-slate-400 hidden md:block">
                      {ag.total_policies}
                    </p>
                    <p className="relative text-right text-sm text-slate-600 dark:text-slate-400 hidden md:block">
                      {ag.advisor_count}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Franchise Breakdown */}
      {franchise.length > 0 && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-500" />
              Franchise Network
            </CardTitle>
            <CardDescription>Child org performance (delegation-scoped)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hidden md:grid md:grid-cols-[1fr_7rem_6rem_5rem] gap-4 px-3 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
              <span>Organization</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Policies</span>
              <span className="text-right">Advisors</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {franchise.map((child, idx) => (
                <div
                  key={child.child_org_id}
                  className="flex items-center md:grid md:grid-cols-[1fr_7rem_6rem_5rem] gap-4 px-3 py-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}</span>
                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {child.child_org_name}
                    </p>
                  </div>
                  <p className="text-right font-bold text-sm text-slate-900 dark:text-white">
                    {formatCurrency(child.total_commission)}
                  </p>
                  <p className="text-right text-sm text-slate-600 dark:text-slate-400 hidden md:block">
                    {child.total_policies}
                  </p>
                  <p className="text-right text-sm text-slate-600 dark:text-slate-400 hidden md:block">
                    {child.total_advisors}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
