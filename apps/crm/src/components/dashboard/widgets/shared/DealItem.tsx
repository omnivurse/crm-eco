'use client';

import Link from 'next/link';
import { Timer } from 'lucide-react';

interface AtRiskDeal {
  id: string;
  name: string;
  value: number;
  stage: string;
  daysInStage: number;
}

interface GenericDeal {
  id: string;
  name: string;
  amount?: number;
  value?: number;
  stage?: string;
  stage_name?: string;
}

interface DealItemProps {
  deal: AtRiskDeal | GenericDeal;
  showStaleIndicator?: boolean;
}

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function isAtRiskDeal(deal: AtRiskDeal | GenericDeal): deal is AtRiskDeal {
  return 'daysInStage' in deal;
}

function getDealAmount(deal: AtRiskDeal | GenericDeal): number {
  if ('value' in deal && typeof deal.value === 'number') return deal.value;
  if ('amount' in deal && typeof deal.amount === 'number') return deal.amount;
  return 0;
}

function getDealStage(deal: AtRiskDeal | GenericDeal): string {
  if ('stage' in deal && typeof deal.stage === 'string') return deal.stage;
  if ('stage_name' in deal && typeof deal.stage_name === 'string') return deal.stage_name;
  return '';
}

export function DealItem({ deal, showStaleIndicator = true }: DealItemProps) {
  const amount = getDealAmount(deal);
  const stageName = getDealStage(deal);

  return (
    <Link
      href={`/crm/r/${deal.id}`}
      className="group flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {deal.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {stageName && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {stageName}
            </span>
          )}
          {showStaleIndicator && isAtRiskDeal(deal) && (
            <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
              <Timer className="w-3 h-3" />
              {deal.daysInStage}d stale
            </span>
          )}
        </div>
      </div>
      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 ml-3">
        {formatCurrency(amount)}
      </span>
    </Link>
  );
}

export type { AtRiskDeal, GenericDeal };
