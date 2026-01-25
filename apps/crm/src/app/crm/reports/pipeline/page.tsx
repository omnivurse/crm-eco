'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  Target,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  Download,
  Loader2,
  Clock,
  DollarSign,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
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
  data: {
    amount?: number;
    close_date?: string;
    probability?: number;
  } | null;
  stage_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StageHistoryData {
  id: string;
  record_id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
}

interface PipelineStats {
  totalDeals: number;
  totalPipelineValue: number;
  avgDealSize: number;
  avgDaysInPipeline: number;
  winRate: number;
  avgDealVelocity: number;
}

interface StageData {
  stage: string;
  count: number;
  value: number;
  avgDaysInStage: number;
  conversionRate: number;
}

interface VelocityData {
  stage: string;
  avgDays: number;
}

interface AgingDeal {
  id: string;
  title: string;
  stage: string;
  value: number;
  daysInStage: number;
  risk: 'low' | 'medium' | 'high';
}

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
  change,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', change >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{change >= 0 ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function PipelineStages({ stages }: { stages: StageData[] }) {
  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Pipeline by Stage</h3>
          <p className="text-sm text-slate-500">Deal count and value per stage</p>
        </div>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => (
          <div key={stage.stage} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                  stage.stage === 'Closed Won' ? 'bg-emerald-500' :
                  stage.stage === 'Closed Lost' ? 'bg-red-500' :
                  'bg-gradient-to-br from-amber-500 to-orange-600'
                )}>
                  {index + 1}
                </div>
                <span className="text-slate-700 dark:text-slate-300">{stage.stage}</span>
              </div>
              <div className="flex items-center gap-4 text-right">
                <span className="text-slate-500">{stage.count} deals</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(stage.value)}</span>
              </div>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  stage.stage === 'Closed Won' ? 'bg-emerald-500' :
                  stage.stage === 'Closed Lost' ? 'bg-red-400' :
                  'bg-gradient-to-r from-amber-500 to-orange-600'
                )}
                style={{ width: `${(stage.value / maxValue) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Avg {stage.avgDaysInStage} days in stage</span>
              <span>{stage.conversionRate}% conversion</span>
            </div>
          </div>
        ))}
        {stages.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No pipeline data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DealVelocity({ data }: { data: VelocityData[] }) {
  const maxDays = Math.max(...data.map(d => d.avgDays), 1);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Stage Velocity</h3>
          <p className="text-sm text-slate-500">Average days spent in each stage</p>
        </div>
      </div>

      <div className="h-48 flex items-end gap-3">
        {data.map((item) => (
          <div key={item.stage} className="flex-1 flex flex-col items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item.avgDays}d</span>
            <div
              className="w-full bg-gradient-to-t from-violet-500 to-purple-400 rounded-t transition-all"
              style={{ height: `${(item.avgDays / maxDays) * 100}%`, minHeight: item.avgDays > 0 ? '8px' : '0' }}
            />
            <span className="text-xs text-slate-500 text-center truncate w-full" title={item.stage}>
              {item.stage.length > 8 ? item.stage.slice(0, 8) + '...' : item.stage}
            </span>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No velocity data available</p>
        </div>
      )}
    </div>
  );
}

function StageConversion({ stages }: { stages: StageData[] }) {
  // Filter out closed stages for conversion flow
  const activeStages = stages.filter(s =>
    s.stage !== 'Closed Won' && s.stage !== 'Closed Lost'
  );

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Stage Conversion Flow</h3>
          <p className="text-sm text-slate-500">Progression rates between stages</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
        {activeStages.map((stage, index) => (
          <div key={stage.stage} className="flex items-center gap-2 flex-shrink-0">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-2">
                <span className="text-lg font-bold text-amber-600">{stage.count}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[80px]" title={stage.stage}>
                {stage.stage}
              </p>
            </div>
            {index < activeStages.length - 1 && (
              <div className="flex flex-col items-center px-2">
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-emerald-600 font-medium">
                  {stage.conversionRate}%
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Final outcomes */}
        <div className="flex flex-col gap-2 ml-4 pl-4 border-l border-slate-200 dark:border-slate-700">
          {stages.filter(s => s.stage === 'Closed Won').map(s => (
            <div key={s.stage} className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-emerald-600">{s.count} Won</p>
                <p className="text-xs text-slate-500">{formatCurrency(s.value)}</p>
              </div>
            </div>
          ))}
          {stages.filter(s => s.stage === 'Closed Lost').map(s => (
            <div key={s.stage} className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-600">{s.count} Lost</p>
                <p className="text-xs text-slate-500">{formatCurrency(s.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgingDeals({ deals }: { deals: AgingDeal[] }) {
  const riskColors = {
    low: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    medium: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    high: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
  };

  const riskTextColors = {
    low: 'text-emerald-600',
    medium: 'text-amber-600',
    high: 'text-rose-600',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        Stale Deals
      </h3>

      <div className="space-y-3">
        {deals.map((deal) => (
          <div
            key={deal.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              riskColors[deal.risk]
            )}
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{deal.title}</p>
              <p className="text-sm text-slate-500">{deal.stage}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(deal.value)}</p>
              <p className={cn('text-sm font-medium', riskTextColors[deal.risk])}>
                {deal.daysInStage} days in stage
              </p>
            </div>
          </div>
        ))}
        {deals.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No stale deals</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function PipelineHealthPage() {
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<DealData[]>([]);
  const [stats, setStats] = useState<PipelineStats>({
    totalDeals: 0,
    totalPipelineValue: 0,
    avgDealSize: 0,
    avgDaysInPipeline: 0,
    winRate: 0,
    avgDealVelocity: 0,
  });
  const [stageData, setStageData] = useState<StageData[]>([]);
  const [velocityData, setVelocityData] = useState<VelocityData[]>([]);
  const [agingDeals, setAgingDeals] = useState<AgingDeal[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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

      // Fetch all deals
      const { data: dealsData } = await supabase
        .from('crm_records')
        .select('id, title, stage, data, stage_updated_at, created_at, updated_at')
        .eq('module_id', dealsModule.id)
        .order('created_at', { ascending: false });

      const allDeals = (dealsData || []) as unknown as DealData[];
      setDeals(allDeals);

      // Fetch stage history for velocity calculations
      const dealIds = allDeals.map(d => d.id);
      const { data: stageHistory } = await supabase
        .from('crm_deal_stage_history')
        .select('id, record_id, from_stage, to_stage, created_at')
        .in('record_id', dealIds.length > 0 ? dealIds : [''])
        .order('created_at', { ascending: true });

      const historyData = (stageHistory || []) as StageHistoryData[];

      // Calculate stats
      const now = new Date();
      const activeDeals = allDeals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');
      const closedWon = allDeals.filter(d => d.stage === 'Closed Won');
      const closedLost = allDeals.filter(d => d.stage === 'Closed Lost');

      const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.data?.amount || 0), 0);
      const avgDealSize = allDeals.length > 0
        ? Math.round(allDeals.reduce((sum, d) => sum + (d.data?.amount || 0), 0) / allDeals.length)
        : 0;

      // Calculate average days in pipeline
      const daysInPipeline = activeDeals.map(d => {
        const created = new Date(d.created_at).getTime();
        return (now.getTime() - created) / (1000 * 60 * 60 * 24);
      });
      const avgDaysInPipeline = daysInPipeline.length > 0
        ? Math.round(daysInPipeline.reduce((a, b) => a + b, 0) / daysInPipeline.length)
        : 0;

      // Win rate
      const totalClosed = closedWon.length + closedLost.length;
      const winRate = totalClosed > 0 ? Math.round((closedWon.length / totalClosed) * 100) : 0;

      // Average deal velocity (days from creation to close for won deals)
      const wonVelocities = closedWon.map(d => {
        const created = new Date(d.created_at).getTime();
        const closed = new Date(d.updated_at).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      });
      const avgVelocity = wonVelocities.length > 0
        ? Math.round(wonVelocities.reduce((a, b) => a + b, 0) / wonVelocities.length)
        : 0;

      setStats({
        totalDeals: allDeals.length,
        totalPipelineValue: pipelineValue,
        avgDealSize,
        avgDaysInPipeline,
        winRate,
        avgDealVelocity: avgVelocity,
      });

      // Calculate stage data
      const stageMap = new Map<string, { deals: DealData[]; value: number }>();
      allDeals.forEach(deal => {
        const stage = deal.stage || 'Unknown';
        const existing = stageMap.get(stage) || { deals: [], value: 0 };
        existing.deals.push(deal);
        existing.value += deal.data?.amount || 0;
        stageMap.set(stage, existing);
      });

      // Calculate time in each stage using history
      const stageDurations = new Map<string, number[]>();
      const dealStageMap = new Map<string, { stage: string; entered: Date }[]>();

      // Build stage entry times from history
      historyData.forEach(h => {
        const dealHistory = dealStageMap.get(h.record_id) || [];
        dealHistory.push({
          stage: h.to_stage,
          entered: new Date(h.created_at),
        });
        dealStageMap.set(h.record_id, dealHistory);
      });

      // Calculate duration in each stage
      dealStageMap.forEach((history) => {
        for (let i = 0; i < history.length; i++) {
          const current = history[i];
          const next = history[i + 1];
          const exitTime = next ? next.entered.getTime() : now.getTime();
          const duration = (exitTime - current.entered.getTime()) / (1000 * 60 * 60 * 24);

          const durations = stageDurations.get(current.stage) || [];
          durations.push(duration);
          stageDurations.set(current.stage, durations);
        }
      });

      // Define stage order
      const stageOrder = ['Qualification', 'Needs Analysis', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

      const stages: StageData[] = Array.from(stageMap.entries())
        .map(([stage, data]) => {
          const durations = stageDurations.get(stage) || [];
          const avgDaysInStage = durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0;

          // Calculate conversion rate (how many moved to next stage)
          const nextStageIndex = stageOrder.indexOf(stage) + 1;
          let movedToNext = 0;
          if (nextStageIndex < stageOrder.length && stage !== 'Closed Won' && stage !== 'Closed Lost') {
            data.deals.forEach(deal => {
              const dealHistory = dealStageMap.get(deal.id) || [];
              const hasMovedForward = dealHistory.some(h => stageOrder.indexOf(h.stage) > stageOrder.indexOf(stage));
              if (hasMovedForward) movedToNext++;
            });
          }
          const conversionRate = data.deals.length > 0 ? Math.round((movedToNext / data.deals.length) * 100) : 0;

          return {
            stage,
            count: data.deals.length,
            value: data.value,
            avgDaysInStage,
            conversionRate: stage === 'Closed Won' || stage === 'Closed Lost' ? 0 : conversionRate,
          };
        })
        .sort((a, b) => {
          const aIdx = stageOrder.indexOf(a.stage);
          const bIdx = stageOrder.indexOf(b.stage);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });

      setStageData(stages);

      // Velocity data (excluding closed stages)
      const velocity: VelocityData[] = stages
        .filter(s => s.stage !== 'Closed Won' && s.stage !== 'Closed Lost')
        .map(s => ({
          stage: s.stage,
          avgDays: s.avgDaysInStage,
        }));
      setVelocityData(velocity);

      // Aging deals (deals that have been in same stage for too long)
      const aging: AgingDeal[] = activeDeals
        .map(deal => {
          const stageUpdated = deal.stage_updated_at
            ? new Date(deal.stage_updated_at).getTime()
            : new Date(deal.created_at).getTime();
          const daysInStage = Math.floor((now.getTime() - stageUpdated) / (1000 * 60 * 60 * 24));

          let risk: 'low' | 'medium' | 'high' = 'low';
          if (daysInStage > 30) risk = 'high';
          else if (daysInStage > 14) risk = 'medium';

          return {
            id: deal.id,
            title: deal.title,
            stage: deal.stage,
            value: deal.data?.amount || 0,
            daysInStage,
            risk,
          };
        })
        .filter(d => d.daysInStage > 7) // Only show deals older than 7 days in stage
        .sort((a, b) => b.daysInStage - a.daysInStage)
        .slice(0, 5);

      setAgingDeals(aging);

    } catch (error) {
      console.error('Error loading pipeline data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/reports">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg">
                <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline Health</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Deal velocity and stage analysis
            </p>
          </div>
        </div>

        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Deals" value={stats.totalDeals.toLocaleString()} icon={Target} color="amber" />
        <StatCard label="Pipeline Value" value={formatCurrency(stats.totalPipelineValue)} icon={DollarSign} color="emerald" />
        <StatCard label="Avg Deal Size" value={formatCurrency(stats.avgDealSize)} icon={BarChart3} color="blue" />
        <StatCard label="Avg Days in Pipeline" value={stats.avgDaysInPipeline} icon={Clock} color="violet" />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} icon={TrendingUp} color="teal" />
        <StatCard label="Avg Days to Close" value={stats.avgDealVelocity} icon={Clock} color="rose" />
      </div>

      {/* Stage Conversion Flow */}
      <StageConversion stages={stageData} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineStages stages={stageData} />
        <DealVelocity data={velocityData} />
      </div>

      {/* Aging Deals */}
      <AgingDeals deals={agingDeals} />
    </div>
  );
}
