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
  RefreshCw,
  BarChart3,
  Trophy,
  Target,
  Layers,
  Shield,
  Heart,
  Crown,
  Flame,
  Medal,
  Zap,
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

interface PersonalMetrics {
  total_commissions: number;
  paid_commissions: number;
  pending_commissions: number;
  total_enrollments: number;
  signup_commissions: number;
  monthly_commissions: number;
  override_commissions: number;
  avg_commission: number;
}

interface DownlineMetrics {
  total_commissions: number;
  total_enrollments: number;
  active_advisors: number;
  avg_per_advisor: number;
}

interface MonthlyTrend {
  month: string;
  personal_commissions: number;
  downline_commissions: number;
  personal_enrollments: number;
  downline_enrollments: number;
  total_commissions: number;
}

interface TopDownline {
  advisor_id: string;
  first_name: string;
  last_name: string;
  email: string;
  commission_tier: string | null;
  total_commissions: number;
  total_enrollments: number;
}

interface OrgSummary {
  total_commissions: number;
  paid_amount: number;
  pending_amount: number;
  approved_amount: number;
  total_enrollments: number;
  active_advisors: number;
  avg_commission: number;
}

interface OrgMonthly {
  month: string;
  total_commissions: number;
  total_enrollments: number;
  active_advisors: number;
  paid_amount: number;
}

interface ProductBreakdown {
  product_type: string;
  total_commissions: number;
  total_enrollments: number;
  commission_count: number;
}

interface GrowthMetrics {
  current_month: { commissions: number; enrollments: number };
  previous_month: { commissions: number; enrollments: number };
  growth_pct: { commissions: number; enrollments: number };
}

interface AnalyticsData {
  advisor: {
    personal: PersonalMetrics;
    downline: DownlineMetrics;
    monthly: MonthlyTrend[];
    top_downline: TopDownline[];
  } | null;
  org: {
    summary: OrgSummary;
    monthly: OrgMonthly[];
    by_product: ProductBreakdown[];
  } | null;
  growth: GrowthMetrics | null;
  isAdmin: boolean;
  advisorId: string | null;
}

interface LeaderboardEntry {
  advisor_id: string;
  first_name: string;
  last_name: string;
  email: string;
  commission_tier: string | null;
  rank_position: number;
  tier: string;
  production_score: number;
  total_commissions: number;
  total_enrollments: number;
  downline_production: number;
  growth_rate_pct: number;
  rank_change: number;
  streak_months: number;
  next_tier_gap: number;
}

interface MyRanking {
  ranked: boolean;
  rank_position?: number;
  total_ranked?: number;
  tier?: string;
  production_score?: number;
  total_commissions?: number;
  total_enrollments?: number;
  rank_change?: number;
  streak_months?: number;
  next_tier_gap?: number;
}

interface RankingsData {
  leaderboard: { leaderboard: LeaderboardEntry[]; month: string; total_ranked: number };
  myRanking: MyRanking;
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

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Trophy }> = {
  bronze: { label: 'Bronze', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: Medal },
  silver: { label: 'Silver', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-300/20 border-slate-400/30', icon: Medal },
  gold: { label: 'Gold', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', icon: Trophy },
  platinum: { label: 'Platinum', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30', icon: Crown },
  elite: { label: 'Elite', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', icon: Flame },
};

function TierBadge({ tier }: { tier: string }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function GrowthIndicator({ value }: { value: number }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400'
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {Math.abs(value)}%
    </span>
  );
}

/** Simple bar chart using CSS */
function MiniBarChart({
  data,
  valueKey,
  maxBars = 12,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  valueKey: string;
  maxBars?: number;
}) {
  const sliced = data.slice(-maxBars);
  const max = Math.max(...sliced.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="flex items-end gap-1 h-24">
      {sliced.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-teal-500/80 hover:bg-teal-500 transition-colors min-h-[2px]"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={`${formatMonth(d.month as string)}: ${formatCurrency(val)}`}
            />
            <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate w-full text-center">
              {formatMonth(d.month as string)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Stacked bar chart for personal vs downline */
function StackedBarChart({
  data,
  maxBars = 12,
}: {
  data: MonthlyTrend[];
  maxBars?: number;
}) {
  const sliced = data.slice(-maxBars);
  const max = Math.max(
    ...sliced.map((d) => d.personal_commissions + d.downline_commissions),
    1,
  );

  return (
    <div className="flex items-end gap-1 h-32">
      {sliced.map((d, i) => {
        const personalPct = (d.personal_commissions / max) * 100;
        const downlinePct = (d.downline_commissions / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
              <div
                className="w-full bg-violet-500/70 rounded-t"
                style={{ height: `${Math.max(downlinePct, 0)}%` }}
                title={`Downline: ${formatCurrency(d.downline_commissions)}`}
              />
              <div
                className="w-full bg-teal-500/80"
                style={{ height: `${Math.max(personalPct, 1)}%` }}
                title={`Personal: ${formatCurrency(d.personal_commissions)}`}
              />
            </div>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate w-full text-center">
              {formatMonth(d.month)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PerformanceAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [rankings, setRankings] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [months, setMonths] = useState('12');
  const [capacityScope, setCapacityScope] = useState<string>('all');
  const [leaderboardMonth, setLeaderboardMonth] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const rankParams = new URLSearchParams({ limit: '10' });
      if (capacityScope !== 'all') rankParams.set('capacity_scope', capacityScope);
      if (leaderboardMonth) rankParams.set('month', leaderboardMonth);

      const [perfRes, rankRes] = await Promise.all([
        fetch(`/api/analytics/advisor-performance?months=${months}`),
        fetch(`/api/analytics/rankings?${rankParams}`).catch(() => null),
      ]);

      if (perfRes.ok) {
        setData(await perfRes.json());
      } else {
        toast.error('Failed to load performance analytics');
      }

      if (rankRes?.ok) {
        setRankings(await rankRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      toast.error('Failed to load performance analytics');
    } finally {
      setLoading(false);
    }
  }, [months, capacityScope, leaderboardMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/analytics/refresh', { method: 'POST' });
      if (!res.ok) throw new Error('Refresh failed');
      toast.success('Analytics data refreshed');
      await fetchData();
    } catch {
      toast.error('Failed to refresh analytics');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  const advisor = data?.advisor;
  const org = data?.org;
  const growth = data?.growth;
  const isAdmin = data?.isAdmin ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Performance Analytics
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {isAdmin ? 'Organization-wide' : 'Personal'} commission performance
            &amp; downline metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-32 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              variant="outline"
              className="border-slate-300 dark:border-slate-700"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Data
            </Button>
          )}
        </div>
      </div>

      {/* Growth Summary */}
      {growth && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass-card border-slate-200 dark:border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-teal-500/10">
                  <TrendingUp className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Commission Growth (MoM)
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(growth.current_month.commissions)}
                    </p>
                    <GrowthIndicator value={growth.growth_pct.commissions} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    vs {formatCurrency(growth.previous_month.commissions)} last month
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-slate-200 dark:border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Enrollment Growth (MoM)
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {growth.current_month.enrollments}
                    </p>
                    <GrowthIndicator value={growth.growth_pct.enrollments} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    vs {growth.previous_month.enrollments} last month
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Personal Metrics */}
      {advisor && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Personal Performance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total Commissions
                      </p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(advisor.personal.total_commissions)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(advisor.personal.pending_commissions)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Enrollments</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {advisor.personal.total_enrollments}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Overrides</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(advisor.personal.override_commissions)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Downline Metrics */}
          {advisor.downline && advisor.downline.active_advisors > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                Downline Performance
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-teal-500/10">
                        <DollarSign className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Downline Commissions
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {formatCurrency(advisor.downline.total_commissions)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-500/10">
                        <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Active Sub-Advisors
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {advisor.downline.active_advisors}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Downline Enrollments
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {advisor.downline.total_enrollments}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Avg per Advisor
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {formatCurrency(advisor.downline.avg_per_advisor)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Monthly Trend Chart */}
          {advisor.monthly && advisor.monthly.length > 0 && (
            <Card className="glass-card border-slate-200 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">
                  Commission Trend
                </CardTitle>
                <CardDescription>
                  Personal vs downline commissions over time
                </CardDescription>
                <div className="flex items-center gap-4 text-xs mt-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-teal-500/80" />
                    Personal
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-violet-500/70" />
                    Downline
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <StackedBarChart data={advisor.monthly} />
              </CardContent>
            </Card>
          )}

          {/* Top Downline Performers */}
          {advisor.top_downline && advisor.top_downline.length > 0 && (
            <Card className="glass-card border-slate-200 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Top Downline Performers
                </CardTitle>
                <CardDescription>Ranked by total commissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {advisor.top_downline.map(
                    (performer: TopDownline, idx: number) => (
                      <div
                        key={performer.advisor_id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                      >
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : idx === 1
                                ? 'bg-slate-300/30 text-slate-600 dark:text-slate-400'
                                : idx === 2
                                  ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                            {performer.first_name} {performer.last_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {performer.email}
                            {performer.commission_tier &&
                              ` \u00B7 ${performer.commission_tier}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            {formatCurrency(performer.total_commissions)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {performer.total_enrollments} enrollments
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Org-Wide Section (Admin only) */}
      {isAdmin && org && (
        <>
          <div className="pt-4 border-t border-slate-200 dark:border-white/10">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Organization Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total Commissions
                      </p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(org.summary.total_commissions)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Paid Out</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(org.summary.paid_amount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(org.summary.pending_amount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Active Advisors
                      </p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {org.summary.active_advisors}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Org Monthly Trend */}
          {org.monthly && org.monthly.length > 0 && (
            <Card className="glass-card border-slate-200 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">
                  Organization Commission Trend
                </CardTitle>
                <CardDescription>Total commissions by month</CardDescription>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={org.monthly} valueKey="total_commissions" />
              </CardContent>
            </Card>
          )}

          {/* Product Type Breakdown */}
          {org.by_product && org.by_product.length > 0 && (
            <Card className="glass-card border-slate-200 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">
                  Commission by Product Type
                </CardTitle>
                <CardDescription>Breakdown across capacity types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {org.by_product.map((product: ProductBreakdown) => {
                    const label =
                      product.product_type === 'health_insurance'
                        ? 'Health Insurance'
                        : product.product_type === 'health_share'
                          ? 'Health Share'
                          : product.product_type === 'all'
                            ? 'All Types'
                            : product.product_type;
                    const Icon =
                      product.product_type === 'health_insurance'
                        ? Shield
                        : product.product_type === 'health_share'
                          ? Heart
                          : BarChart3;
                    const color =
                      product.product_type === 'health_insurance'
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                        : product.product_type === 'health_share'
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                          : 'text-slate-600 dark:text-slate-400 bg-slate-500/10';

                    return (
                      <div
                        key={product.product_type}
                        className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                      >
                        <div className={`p-2 rounded-lg ${color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-slate-900 dark:text-white">
                            {label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {product.total_enrollments} enrollments &middot;{' '}
                            {product.commission_count} commissions
                          </p>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(product.total_commissions)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* My Ranking + Leaderboard */}
      {rankings && rankings.leaderboard.leaderboard.length > 0 && (
        <div className="space-y-4">
          {/* My Ranking Card */}
          {rankings.myRanking.ranked && (
            <Card className="glass-card border-slate-200 dark:border-white/10 bg-gradient-to-r from-amber-500/5 to-violet-500/5">
              <CardContent className="pt-6 pb-5">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                      #{rankings.myRanking.rank_position}
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Your Rank</p>
                      <div className="flex items-center gap-2">
                        {rankings.myRanking.tier && (
                          <TierBadge tier={rankings.myRanking.tier} />
                        )}
                        {(rankings.myRanking.rank_change ?? 0) !== 0 && (
                          <span className={`text-xs font-medium ${
                            (rankings.myRanking.rank_change ?? 0) > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {(rankings.myRanking.rank_change ?? 0) > 0 ? '+' : ''}
                            {rankings.myRanking.rank_change} positions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1" />
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {Math.round(rankings.myRanking.production_score || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(rankings.myRanking.total_commissions || 0)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Commissions</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {rankings.myRanking.total_enrollments || 0}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Enrollments</p>
                    </div>
                  </div>
                  {(rankings.myRanking.next_tier_gap ?? 0) > 0 && rankings.myRanking.tier && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Next: {TIER_CONFIG[
                          rankings.myRanking.tier === 'bronze' ? 'silver'
                            : rankings.myRanking.tier === 'silver' ? 'gold'
                            : rankings.myRanking.tier === 'gold' ? 'platinum'
                            : 'elite'
                        ]?.label ?? 'Next Tier'}
                      </p>
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        {Math.round(rankings.myRanking.next_tier_gap || 0).toLocaleString()} pts away
                      </p>
                    </div>
                  )}
                  {(rankings.myRanking.streak_months ?? 0) > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/30">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                        {rankings.myRanking.streak_months}mo streak
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard */}
          <Card className="glass-card border-slate-200 dark:border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Leaderboard
                  </CardTitle>
                  <CardDescription>
                    {rankings.leaderboard.total_ranked} advisors ranked
                    {capacityScope !== 'all' && (
                      <span> &middot; {capacityScope === 'health_insurance' ? 'Insurance' : 'Health Share'}</span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={capacityScope} onValueChange={setCapacityScope}>
                    <SelectTrigger className="w-36 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Capacities</SelectItem>
                      <SelectItem value="health_insurance">Insurance</SelectItem>
                      <SelectItem value="health_share">Health Share</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="month"
                    value={leaderboardMonth ? leaderboardMonth.slice(0, 7) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLeaderboardMonth(v ? `${v}-01` : '');
                    }}
                    className="h-8 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rankings.leaderboard.leaderboard.map((entry: LeaderboardEntry, idx: number) => (
                  <div
                    key={entry.advisor_id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : idx === 1
                            ? 'bg-slate-300/30 text-slate-600 dark:text-slate-400'
                            : idx === 2
                              ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}
                    >
                      {entry.rank_position}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {entry.first_name} {entry.last_name}
                        </p>
                        <TierBadge tier={entry.tier} />
                        {entry.rank_change > 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            +{entry.rank_change}
                          </span>
                        )}
                        {entry.streak_months > 0 && (
                          <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" />{entry.streak_months}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {Math.round(entry.production_score).toLocaleString()} pts
                        {entry.commission_tier && ` \u00B7 ${entry.commission_tier}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {formatCurrency(entry.total_commissions)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {entry.total_enrollments} enrollments
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!advisor && !org && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Performance Data Yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Performance analytics are generated from commission data. Once commissions are
              processed, metrics will appear here automatically.
            </p>
            {isAdmin && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Analytics
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
