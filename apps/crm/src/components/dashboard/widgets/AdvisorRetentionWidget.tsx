import { TrendingUp } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';

interface RetentionDataPoint {
  month: string;
  retention_rate: number;
  total_members: number;
  retained_members: number;
}

interface AdvisorRetentionWidgetProps {
  data: RetentionDataPoint[] | null;
  size: WidgetSize;
}

export default function AdvisorRetentionWidget({
  data,
  size,
}: AdvisorRetentionWidgetProps) {
  const points = data || [];
  const currentRate = points.length > 0 ? points[points.length - 1].retention_rate : 0;
  const maxRate = Math.max(...points.map((p) => p.retention_rate), 100);
  const minRate = Math.min(...points.map((p) => p.retention_rate), 0);
  const range = maxRate - minRate || 1;

  // Chart dimensions
  const chartHeight = size === 'medium' ? 120 : 180;
  const chartWidth = 100; // percentage-based

  return (
    <WidgetCard
      title="Advisor Member Retention"
      subtitle="Monthly retention rate trends"
      icon={<TrendingUp className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500"
      badge={`${currentRate.toFixed(1)}%`}
      badgeColor={
        currentRate >= 90
          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
          : currentRate >= 75
            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
      }
    >
      {points.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No retention data available</p>
        </div>
      ) : (
        <div>
          {/* SVG Line Chart */}
          <div className="relative" style={{ height: chartHeight }}>
            <svg
              viewBox={`0 0 ${points.length > 1 ? (points.length - 1) * 50 : 50} ${chartHeight}`}
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = chartHeight - ((pct - minRate) / range) * chartHeight;
                return (
                  <line
                    key={pct}
                    x1="0"
                    y1={y}
                    x2={(points.length > 1 ? (points.length - 1) * 50 : 50).toString()}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-700"
                    strokeWidth="0.5"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Area fill */}
              {points.length > 1 && (
                <path
                  d={
                    `M0,${chartHeight - ((points[0].retention_rate - minRate) / range) * chartHeight}` +
                    points
                      .slice(1)
                      .map(
                        (p, i) =>
                          `L${(i + 1) * 50},${chartHeight - ((p.retention_rate - minRate) / range) * chartHeight}`
                      )
                      .join('') +
                    `L${(points.length - 1) * 50},${chartHeight}L0,${chartHeight}Z`
                  }
                  className="fill-blue-500/10 dark:fill-blue-400/10"
                />
              )}

              {/* Line */}
              {points.length > 1 && (
                <polyline
                  points={points
                    .map(
                      (p, i) =>
                        `${i * 50},${chartHeight - ((p.retention_rate - minRate) / range) * chartHeight}`
                    )
                    .join(' ')}
                  className="stroke-blue-500 dark:stroke-blue-400"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={i * 50}
                  cy={chartHeight - ((p.retention_rate - minRate) / range) * chartHeight}
                  r="3"
                  className="fill-blue-500 dark:fill-blue-400 stroke-white dark:stroke-slate-900"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          </div>

          {/* Month labels */}
          <div className="flex justify-between mt-2 px-1">
            {points.map((p, i) => (
              <span
                key={i}
                className="text-[10px] text-slate-400 dark:text-slate-500"
              >
                {p.month}
              </span>
            ))}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {currentRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Current</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {(points.reduce((s, p) => s + p.retention_rate, 0) / points.length).toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Average</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {points.reduce((s, p) => s + p.total_members, 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Total Members</p>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
