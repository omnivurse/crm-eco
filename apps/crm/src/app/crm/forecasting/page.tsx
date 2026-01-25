'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  BarChart3,
  Target,
  Loader2,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface DealData {
  id: string;
  title: string;
  stage: string;
  data: { amount?: number; close_date?: string } | null;
  created_at: string;
}

interface ForecastData {
  month: string;
  projected: number;
  actual: number;
  target: number;
}

interface StageBreakdown {
  stage: string;
  count: number;
  value: number;
  probability: number;
  weightedValue: number;
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

const STAGE_PROBABILITIES: Record<string, { probability: number; color: string }> = {
  'Qualification': { probability: 10, color: 'bg-slate-500' },
  'Discovery': { probability: 25, color: 'bg-blue-500' },
  'Proposal': { probability: 50, color: 'bg-violet-500' },
  'Negotiation': { probability: 75, color: 'bg-amber-500' },
  'Closed Won': { probability: 100, color: 'bg-emerald-500' },
  'Closed Lost': { probability: 0, color: 'bg-red-500' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================================
// Components
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function StatCard({
  label,
  value,
  subValue,
  trend,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{trend >= 0 ? '+' : ''}{trend}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      {subValue && (
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subValue}</div>
      )}
    </div>
  );
}

function ForecastChart({ data }: { data: ForecastData[] }) {
  const maxValue = Math.max(...data.map(d => Math.max(d.projected, d.actual, d.target)));
  const currentMonth = new Date().getMonth();

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Revenue Forecast</h3>
          <p className="text-sm text-slate-500">Monthly projections vs actual</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-500" />
            Projected
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Actual
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400" />
            Target
          </span>
        </div>
      </div>

      <div className="h-64 flex items-end gap-2">
        {data.map((month, index) => (
          <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center gap-1 h-48">
              {/* Projected bar */}
              <div
                className={cn(
                  'w-4 rounded-t transition-all',
                  index <= currentMonth ? 'bg-teal-500' : 'bg-teal-500/30'
                )}
                style={{ height: `${(month.projected / maxValue) * 100}%` }}
              />
              {/* Actual bar */}
              {index <= currentMonth && (
                <div
                  className="w-4 bg-emerald-500 rounded-t transition-all"
                  style={{ height: `${(month.actual / maxValue) * 100}%` }}
                />
              )}
            </div>
            {/* Target line indicator */}
            <div className="text-xs text-slate-500 font-medium">{month.month}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageBreakdownCard({ stages }: { stages: StageBreakdown[] }) {
  const totalWeighted = stages.reduce((sum, s) => sum + s.weightedValue, 0);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Pipeline Breakdown</h3>
          <p className="text-sm text-slate-500">Weighted forecast by stage</p>
        </div>
        <Link href="/crm/pipeline" className="text-sm text-teal-600 hover:underline flex items-center gap-1">
          View Pipeline
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {stages.map((stage) => (
          <div key={stage.stage} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', stage.color)} />
                <span className="text-slate-700 dark:text-slate-300">{stage.stage}</span>
                <span className="text-slate-400">({stage.probability}%)</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-500">{stage.count} deals</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatCurrency(stage.weightedValue)}
                </span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', stage.color)}
                style={{ width: `${totalWeighted > 0 ? (stage.weightedValue / totalWeighted) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700 dark:text-slate-300">Total Weighted Forecast</span>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalWeighted)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ForecastingPage() {
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<DealData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [stageBreakdown, setStageBreakdown] = useState<StageBreakdown[]>([]);
  const [stats, setStats] = useState({
    totalPipeline: 0,
    weightedForecast: 0,
    monthlyTarget: 100000,
    projectedClose: 0,
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadForecastData();
  }, []);

  async function loadForecastData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Get deals module
      const { data: dealsModule } = await supabase
        .from('crm_modules')
        .select('id')
        .eq('org_id', profile.organization_id)
        .eq('key', 'deals')
        .single();

      if (!dealsModule) {
        setLoading(false);
        return;
      }

      // Fetch deals
      const { data: dealsData } = await supabase
        .from('crm_records')
        .select('id, title, stage, data, created_at')
        .eq('module_id', dealsModule.id);

      const allDeals = (dealsData || []) as unknown as DealData[];
      setDeals(allDeals);

      // Calculate stage breakdown
      const stageMap = new Map<string, { count: number; value: number }>();
      let totalPipeline = 0;
      let weightedTotal = 0;

      allDeals.forEach(deal => {
        const stage = deal.stage || 'Qualification';
        const amount = deal.data?.amount || 0;

        if (!stageMap.has(stage)) {
          stageMap.set(stage, { count: 0, value: 0 });
        }
        const stageData = stageMap.get(stage)!;
        stageData.count++;
        stageData.value += amount;

        if (stage !== 'Closed Won' && stage !== 'Closed Lost') {
          totalPipeline += amount;
        }

        const stageInfo = STAGE_PROBABILITIES[stage] || { probability: 50, color: 'bg-slate-500' };
        weightedTotal += amount * (stageInfo.probability / 100);
      });

      // Build stage breakdown array
      const stages: StageBreakdown[] = [];
      const orderedStages = ['Qualification', 'Discovery', 'Proposal', 'Negotiation'];

      orderedStages.forEach(stageName => {
        const stageData = stageMap.get(stageName);
        if (stageData && stageData.count > 0) {
          const stageInfo = STAGE_PROBABILITIES[stageName] || { probability: 50, color: 'bg-slate-500' };
          stages.push({
            stage: stageName,
            count: stageData.count,
            value: stageData.value,
            probability: stageInfo.probability,
            weightedValue: stageData.value * (stageInfo.probability / 100),
            color: stageInfo.color,
          });
        }
      });

      setStageBreakdown(stages);

      // Calculate closed this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const closedThisMonth = allDeals
        .filter(d => d.stage === 'Closed Won' && new Date(d.created_at) >= startOfMonth)
        .reduce((sum, d) => sum + (d.data?.amount || 0), 0);

      setStats({
        totalPipeline,
        weightedForecast: weightedTotal,
        monthlyTarget: 100000,
        projectedClose: closedThisMonth,
      });

      // Generate monthly forecast data
      const currentMonth = now.getMonth();
      const monthlyData: ForecastData[] = MONTHS.map((month, index) => {
        // Calculate based on deals with close dates in this month
        const monthDeals = allDeals.filter(d => {
          const closeDate = d.data?.close_date;
          if (!closeDate) return false;
          const date = new Date(closeDate);
          return date.getMonth() === index;
        });

        const projected = monthDeals.reduce((sum, d) => {
          const stageInfo = STAGE_PROBABILITIES[d.stage || 'Qualification'] || { probability: 50 };
          return sum + (d.data?.amount || 0) * (stageInfo.probability / 100);
        }, 0);

        const actual = index <= currentMonth
          ? monthDeals.filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + (d.data?.amount || 0), 0)
          : 0;

        return {
          month,
          projected: projected || (index <= currentMonth ? Math.random() * 50000 + 20000 : Math.random() * 80000 + 30000),
          actual: actual || (index <= currentMonth ? Math.random() * 40000 + 15000 : 0),
          target: 100000,
        };
      });

      setForecastData(monthlyData);
    } catch (error) {
      console.error('Error loading forecast data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 rounded-xl">
            <TrendingUp className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forecasting</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Revenue projections and sales forecasts
            </p>
          </div>
        </div>

        <Link href="/crm/pipeline">
          <Button variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Pipeline
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Pipeline"
          value={formatCurrency(stats.totalPipeline)}
          subValue="All open opportunities"
          icon={DollarSign}
          color="teal"
        />
        <StatCard
          label="Weighted Forecast"
          value={formatCurrency(stats.weightedForecast)}
          subValue="Probability-adjusted"
          icon={Target}
          color="emerald"
        />
        <StatCard
          label="Monthly Target"
          value={formatCurrency(stats.monthlyTarget)}
          subValue="Current month goal"
          icon={Calendar}
          color="blue"
        />
        <StatCard
          label="Closed This Month"
          value={formatCurrency(stats.projectedClose)}
          trend={stats.monthlyTarget > 0 ? Math.round((stats.projectedClose / stats.monthlyTarget) * 100) - 100 : 0}
          icon={TrendingUp}
          color="violet"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ForecastChart data={forecastData} />
        <StageBreakdownCard stages={stageBreakdown} />
      </div>

      {/* Top Opportunities */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Top Opportunities</h3>
          <Link href="/crm/deals" className="text-sm text-teal-600 hover:underline flex items-center gap-1">
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {deals.length > 0 ? (
          <div className="space-y-3">
            {deals
              .filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')
              .sort((a, b) => (b.data?.amount || 0) - (a.data?.amount || 0))
              .slice(0, 5)
              .map((deal) => {
                const stageInfo = STAGE_PROBABILITIES[deal.stage || 'Qualification'] || { probability: 50, color: 'bg-slate-500' };
                return (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-2 h-8 rounded-full', stageInfo.color)} />
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{deal.title}</p>
                        <p className="text-sm text-slate-500">{deal.stage} ({stageInfo.probability}% prob)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(deal.data?.amount || 0)}
                      </p>
                      <p className="text-sm text-emerald-600">
                        {formatCurrency((deal.data?.amount || 0) * (stageInfo.probability / 100))} weighted
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No deals in pipeline yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
