'use client';

import Link from 'next/link';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { EmptyState } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface PipelineStage {
  id: string;
  name: string;
  count: number;
  value: number;
  color: string;
}

interface PipelineSummaryData {
  stages: PipelineStage[];
  totalDeals: number;
  totalValue: number;
}

interface PipelineSummaryWidgetProps {
  data: PipelineSummaryData | null;
  size: WidgetSize;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export default function PipelineSummaryWidget({
  data,
  size,
}: PipelineSummaryWidgetProps) {
  const pipeline = data || { stages: [], totalDeals: 0, totalValue: 0 };

  return (
    <WidgetCard
      title="Pipeline Summary"
      subtitle="Deal stages overview"
      icon={<TrendingUp className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-purple-500 via-violet-400 to-purple-500"
      badge={
        pipeline.totalDeals > 0
          ? formatCurrency(pipeline.totalValue)
          : undefined
      }
      badgeColor="bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400"
      footer={
        pipeline.stages.length > 0 ? (
          <Link
            href="/crm/deals"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View pipeline
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {pipeline.stages.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />}
          title="No pipeline data"
          subtitle="Create deals to see your pipeline"
        />
      ) : (
        <div className="space-y-3">
          {pipeline.stages.map((stage) => {
            const percentage = pipeline.totalDeals > 0
              ? (stage.count / pipeline.totalDeals) * 100
              : 0;
            return (
              <div key={stage.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {stage.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {stage.count} deals · {formatCurrency(stage.value)}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: stage.color || '#8b5cf6',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
