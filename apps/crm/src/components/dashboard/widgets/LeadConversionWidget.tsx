'use client';

import Link from 'next/link';
import { Target, ArrowRight, ArrowDown } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { EmptyState } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface FunnelStage {
  name: string;
  count: number;
  color: string;
}

interface LeadConversionData {
  stages: FunnelStage[];
  overallConversionRate: number;
  period: string;
}

interface LeadConversionWidgetProps {
  data: LeadConversionData | null;
  size: WidgetSize;
}

export default function LeadConversionWidget({
  data,
  size,
}: LeadConversionWidgetProps) {
  const conversion = data || {
    stages: [],
    overallConversionRate: 0,
    period: 'Last 30 days',
  };

  const hasData = conversion.stages.length > 0;
  const maxCount = Math.max(...conversion.stages.map((s) => s.count), 1);

  return (
    <WidgetCard
      title="Lead Conversion"
      subtitle={conversion.period}
      icon={<Target className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-rose-500 via-red-400 to-rose-500"
      badge={
        hasData ? `${conversion.overallConversionRate.toFixed(1)}% rate` : undefined
      }
      badgeColor="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400"
      footer={
        hasData ? (
          <Link
            href="/crm/contacts"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View contacts
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {!hasData ? (
        <EmptyState
          icon={<Target className="w-8 h-8 text-rose-600 dark:text-rose-400" />}
          title="No conversion data"
          subtitle="Add leads to see your conversion funnel"
        />
      ) : (
        <div className="space-y-4">
          {conversion.stages.map((stage, index) => {
            const widthPercent = (stage.count / maxCount) * 100;
            const nextStage = conversion.stages[index + 1];
            const dropOff = nextStage
              ? (((stage.count - nextStage.count) / stage.count) * 100).toFixed(0)
              : null;

            return (
              <div key={stage.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {stage.name}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-8 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: stage.color,
                    }}
                  >
                    {widthPercent > 20 && (
                      <span className="text-xs font-medium text-white">
                        {widthPercent.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                {dropOff && Number(dropOff) > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1 text-xs text-slate-400 dark:text-slate-500">
                    <ArrowDown className="w-3 h-3" />
                    <span>{dropOff}% drop-off</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
