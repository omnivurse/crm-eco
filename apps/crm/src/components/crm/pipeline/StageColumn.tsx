'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Badge } from '@crm-eco/ui/components/badge';
import { DealCard } from './DealCard';
import type { CrmRecord, CrmDealStage } from '@/lib/crm/types';

interface StageColumnProps {
  stage: CrmDealStage;
  deals: CrmRecord[];
  totalValue: number;
  isUpdating?: string | null;
  onAddDeal?: () => void;
  wipLimit?: number; // Work-in-progress limit
  defaultCollapsed?: boolean;
  onQuickAction?: (action: 'call' | 'email' | 'task' | 'view' | 'edit' | 'delete', dealId: string) => void;
}

export function StageColumn({
  stage,
  deals,
  totalValue,
  isUpdating,
  onAddDeal,
  wipLimit,
  defaultCollapsed = false,
  onQuickAction,
}: StageColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { isOver, setNodeRef } = useDroppable({
    id: stage.key,
  });

  const isOverWipLimit = wipLimit !== undefined && deals.length > wipLimit;
  const isAtWipLimit = wipLimit !== undefined && deals.length === wipLimit;

  return (
    <div className={cn(
      'flex flex-col transition-all duration-200',
      isCollapsed ? 'min-w-[60px] max-w-[60px]' : 'min-w-[280px] max-w-[320px]'
    )}>
      {/* Column Header */}
      <div className="glass-card rounded-t-xl p-4 border border-slate-200 dark:border-white/10 border-b-0">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 text-left hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            {!isCollapsed && (
              <h3 className="text-slate-900 dark:text-white font-semibold text-sm truncate">
                {stage.name}
              </h3>
            )}
          </button>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className={cn(
                'px-2 py-0.5 text-xs rounded-full',
                isOverWipLimit
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                  : isAtWipLimit
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              )}>
                {deals.length}
                {wipLimit !== undefined && `/${wipLimit}`}
              </span>
              {isOverWipLimit && (
                <AlertTriangle className="w-4 h-4 text-red-500" title="Over WIP limit" />
              )}
              {stage.probability > 0 && !stage.is_won && !stage.is_lost && (
                <span className="text-xs text-slate-500">
                  {stage.probability}%
                </span>
              )}
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            ${totalValue.toLocaleString()}
          </div>
        )}
        {isCollapsed && (
          <div className="flex flex-col items-center gap-1 mt-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {deals.length}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium writing-mode-vertical">
              ${(totalValue / 1000).toFixed(0)}k
            </span>
          </div>
        )}
      </div>

      {/* Cards Container */}
      {!isCollapsed && (
        <div
          ref={setNodeRef}
          className={cn(
            'flex-1 glass rounded-b-xl border border-slate-200 dark:border-white/10 border-t-0 p-3 space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin transition-colors',
            isOver && 'bg-teal-500/5 border-teal-500/30',
            isOverWipLimit && 'border-red-300 dark:border-red-500/30'
          )}
        >
          <SortableContext
            items={deals.map(d => d.id)}
            strategy={verticalListSortingStrategy}
          >
            {deals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-slate-500 dark:text-slate-600 text-sm">
                  No deals in this stage
                </p>
                {isOver && (
                  <p className="text-teal-400 text-xs mt-1">
                    Drop here to move
                  </p>
                )}
              </div>
            ) : (
              deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  isUpdating={isUpdating === deal.id}
                  onQuickAction={onQuickAction}
                />
              ))
            )}
          </SortableContext>

          {/* Add Deal Button */}
          <button
            onClick={onAddDeal}
            className="w-full p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:border-teal-500/50 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Deal
          </button>
        </div>
      )}

      {/* Collapsed Drop Zone */}
      {isCollapsed && (
        <div
          ref={setNodeRef}
          className={cn(
            'flex-1 glass rounded-b-xl border border-slate-200 dark:border-white/10 border-t-0 p-2 min-h-[400px] max-h-[600px] transition-colors',
            isOver && 'bg-teal-500/5 border-teal-500/30'
          )}
        >
          {isOver && (
            <div className="flex items-center justify-center h-full">
              <span className="text-teal-400 text-xs text-center">
                Drop here
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
