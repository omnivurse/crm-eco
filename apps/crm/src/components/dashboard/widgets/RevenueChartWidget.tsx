'use client';

import Link from 'next/link';
import { LineChart, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { EmptyState } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface RevenueDataPoint {
  period: string;
  revenue: number;
  deals: number;
}

interface RevenueChartData {
  data: RevenueDataPoint[];
  totalRevenue: number;
  previousTotalRevenue: number;
  timeframe: 'monthly' | 'quarterly';
}

interface RevenueChartWidgetProps {
  data: RevenueChartData | null;
  size: WidgetSize;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export default function RevenueChartWidget({
  data,
  size,
}: RevenueChartWidgetProps) {
  const chartData = data || {
    data: [],
    totalRevenue: 0,
    previousTotalRevenue: 0,
    timeframe: 'monthly' as const,
  };

  const hasData = chartData.data.length > 0;
  const change = chartData.previousTotalRevenue > 0
    ? ((chartData.totalRevenue - chartData.previousTotalRevenue) /
        chartData.previousTotalRevenue) *
      100
    : 0;
  const isUp = change > 0;

  const maxRevenue = Math.max(...chartData.data.map((d) => d.revenue), 1);

  return (
    <WidgetCard
      title="Revenue Chart"
      subtitle={chartData.timeframe === 'monthly' ? 'Monthly trends' : 'Quarterly trends'}
      icon={<LineChart className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500"
      badge={hasData ? formatCurrency(chartData.totalRevenue) : undefined}
      badgeColor="bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400"
      footer={
        hasData ? (
          <Link
            href="/crm/reports"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View reports
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {!hasData ? (
        <EmptyState
          icon={<LineChart className="w-8 h-8 text-teal-600 dark:text-teal-400" />}
          title="No revenue data"
          subtitle="Close deals to see revenue trends"
        />
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(chartData.totalRevenue)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total Revenue
              </p>
            </div>
            {change !== 0 && (
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  isUp
                    ? 'bg-emerald-100 dark:bg-emerald-500/20'
                    : 'bg-red-100 dark:bg-red-500/20'
                }`}
              >
                {isUp ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                )}
                <span
                  className={`text-sm font-medium ${
                    isUp
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {Math.abs(change).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Simple Bar Chart */}
          <div className="flex items-end gap-1 h-32">
            {chartData.data.map((point, index) => {
              const heightPercent = (point.revenue / maxRevenue) * 100;
              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-gradient-to-t from-teal-500 to-emerald-400 rounded-t transition-all duration-300 hover:from-teal-400 hover:to-emerald-300"
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                    title={`${point.period}: ${formatCurrency(point.revenue)}`}
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500 truncate w-full text-center">
                    {point.period}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
