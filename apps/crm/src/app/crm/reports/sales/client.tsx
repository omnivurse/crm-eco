'use client';

import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  ChevronLeft,
  Download,
  Calendar,
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
  data: { amount?: number; close_date?: string } | null;
  created_at: string;
  updated_at: string;
}

interface SalesStats {
  totalRevenue: number;
  closedDeals: number;
  avgDealSize: number;
  winRate: number;
  pipelineValue: number;
  activeDeals: number;
}

interface MonthlyData {
  month: string;
  closed: number;
  pipeline: number;
}

interface SalesReportClientProps {
  deals: DealData[];
  stats: SalesStats;
  monthlyData: MonthlyData[];
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

function RevenueChart({ data }: { data: MonthlyData[] }) {
  const maxValue = Math.max(...data.flatMap(d => [d.closed, d.pipeline]));

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Revenue Overview</h3>
          <p className="text-sm text-slate-500">Monthly closed vs pipeline</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Closed
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500/50" />
            Pipeline
          </span>
        </div>
      </div>

      <div className="h-64 flex items-end gap-4">
        {data.map((month) => (
          <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center gap-1 h-52">
              <div
                className="w-6 bg-emerald-500 rounded-t transition-all"
                style={{ height: `${maxValue > 0 ? (month.closed / maxValue) * 100 : 0}%` }}
              />
              <div
                className="w-6 bg-blue-500/50 rounded-t transition-all"
                style={{ height: `${maxValue > 0 ? (month.pipeline / maxValue) * 100 : 0}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">{month.month}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopDealsTable({ deals }: { deals: DealData[] }) {
  const sortedDeals = [...deals].sort((a, b) => (b.data?.amount || 0) - (a.data?.amount || 0));

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Top Deals</h3>

      <div className="space-y-3">
        {sortedDeals.slice(0, 5).map((deal) => (
          <div
            key={deal.id}
            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{deal.title}</p>
              <p className="text-sm text-slate-500">{deal.stage}</p>
            </div>
            <span className="font-semibold text-emerald-600">
              {formatCurrency(deal.data?.amount || 0)}
            </span>
          </div>
        ))}
        {deals.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No deals found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Client Component
// ============================================================================

export function SalesReportClient({ deals, stats, monthlyData }: SalesReportClientProps) {
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
              <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sales Performance</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Track deals, revenue, and win rates
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
        <StatCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} color="emerald" />
        <StatCard label="Closed Deals" value={stats.closedDeals} icon={Target} color="blue" />
        <StatCard label="Avg Deal Size" value={formatCurrency(stats.avgDealSize)} icon={BarChart3} color="violet" />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} icon={TrendingUp} color="amber" />
        <StatCard label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} icon={Calendar} color="blue" />
        <StatCard label="Active Deals" value={stats.activeDeals} icon={Users} color="violet" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={monthlyData} />
        <TopDealsTable deals={deals} />
      </div>
    </div>
  );
}
