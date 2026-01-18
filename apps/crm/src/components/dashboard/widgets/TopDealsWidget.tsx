'use client';

import Link from 'next/link';
import { DollarSign, ArrowRight } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { DealItem, EmptyState, type GenericDeal } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface TopDealsWidgetProps {
  data: GenericDeal[] | null;
  size: WidgetSize;
}

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 3,
  medium: 5,
  large: 8,
  full: 10,
};

export default function TopDealsWidget({
  data: topDeals,
  size,
}: TopDealsWidgetProps) {
  const deals = topDeals || [];
  const displayCount = sizeToDisplayCount[size] || 5;
  const totalValue = deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <WidgetCard
      title="Top Deals"
      subtitle="Highest value opportunities"
      icon={<DollarSign className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500"
      badge={
        deals.length > 0 ? formatCurrency(totalValue) : undefined
      }
      badgeColor="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
      footer={
        deals.length > displayCount ? (
          <Link
            href="/crm/deals"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View all deals
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {deals.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />}
          title="No deals yet"
          subtitle="Create deals to see your top opportunities"
        />
      ) : (
        <div className="space-y-1">
          {deals.slice(0, displayCount).map((deal) => (
            <DealItem key={deal.id} deal={deal} showStaleIndicator={false} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
