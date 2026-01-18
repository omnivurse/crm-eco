'use client';

import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { EmptyState } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface Metric {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  format: 'number' | 'currency' | 'percentage';
}

interface PerformanceMetricsData {
  metrics: Metric[];
  period: string;
}

interface PerformanceMetricsWidgetProps {
  data: PerformanceMetricsData | null;
  size: WidgetSize;
}

const formatValue = (value: number, format: Metric['format']) => {
  switch (format) {
    case 'currency':
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value.toFixed(0)}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString();
  }
};

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 4,
  medium: 6,
  large: 8,
  full: 10,
};

export default function PerformanceMetricsWidget({
  data,
  size,
}: PerformanceMetricsWidgetProps) {
  const performance = data || { metrics: [], period: 'This month' };
  const displayCount = sizeToDisplayCount[size] || 6;

  return (
    <WidgetCard
      title="Performance Metrics"
      subtitle={performance.period}
      icon={<BarChart3 className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500"
    >
      {performance.metrics.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />}
          title="No metrics available"
          subtitle="Performance data will appear here"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {performance.metrics.slice(0, displayCount).map((metric) => {
            const change = metric.previousValue > 0
              ? ((metric.value - metric.previousValue) / metric.previousValue) * 100
              : 0;
            const isUp = change > 0;
            const isDown = change < 0;

            return (
              <div
                key={metric.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 truncate">
                  {metric.name}
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatValue(metric.value, metric.format)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {isUp ? (
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                  ) : isDown ? (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  ) : (
                    <Minus className="w-3 h-3 text-slate-400" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      isUp
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isDown
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {Math.abs(change).toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
