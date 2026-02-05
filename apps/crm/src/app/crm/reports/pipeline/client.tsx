'use client';

import Link from 'next/link';
import {
  Target,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  Download,
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

interface PipelineReportClientProps {
  stats: PipelineStats;
  stageData: StageData[];
  velocityData: VelocityData[];
  agingDeals: AgingDeal[];
}

// ============================================================================
// Helper Functions
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

// ============================================================================
// Components
// ============================================================================

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
// Main Client Component
// ============================================================================

export function PipelineReportClient({
  stats,
  stageData,
  velocityData,
  agingDeals,
}: PipelineReportClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/crm/reports">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Pipeline Health</h1>
            </div>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
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
