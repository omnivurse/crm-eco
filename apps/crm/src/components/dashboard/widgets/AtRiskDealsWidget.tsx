'use client';

import Link from 'next/link';
import { Flame, Target, ArrowRight } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { DealItem, EmptyState, type AtRiskDeal } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface AtRiskDealsWidgetProps {
  data: AtRiskDeal[] | null;
  size: WidgetSize;
}

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 3,
  medium: 4,
  large: 6,
  full: 8,
};

function formatTotalValue(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default function AtRiskDealsWidget({
  data: atRiskDeals,
  size,
}: AtRiskDealsWidgetProps) {
  const deals = atRiskDeals || [];
  const totalAtRiskValue = deals.reduce((sum, d) => sum + d.value, 0);
  const displayCount = sizeToDisplayCount[size] || 4;

  return (
    <WidgetCard
      title="At-Risk Deals"
      subtitle="Stale for 7+ days"
      icon={<Flame className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-rose-500 via-red-400 to-rose-500"
      badge={
        deals.length > 0 ? `${formatTotalValue(totalAtRiskValue)} at risk` : undefined
      }
      badgeColor="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
      footer={
        deals.length > displayCount ? (
          <Link
            href="/crm/pipeline"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View pipeline
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {deals.length === 0 ? (
        <EmptyState
          icon={<Target className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />}
          title="Pipeline healthy!"
          subtitle="No stale deals detected"
        />
      ) : (
        <div className="space-y-1">
          {deals.slice(0, displayCount).map((deal) => (
            <DealItem key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
