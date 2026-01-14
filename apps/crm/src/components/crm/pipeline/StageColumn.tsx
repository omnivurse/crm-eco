'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { DealCard } from './DealCard';
import type { CrmRecord, CrmDealStage } from '@/lib/crm/types';

interface StageColumnProps {
  stage: CrmDealStage;
  deals: CrmRecord[];
  totalValue: number;
  isUpdating?: string | null;
  onAddDeal?: () => void;
}

export function StageColumn({
  stage,
  deals,
  totalValue,
  isUpdating,
  onAddDeal,
}: StageColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.key,
  });

  const getStageGradient = () => {
    if (stage.is_won) return 'from-emerald-500 to-green-500';
    if (stage.is_lost) return 'from-red-500 to-rose-500';
    
    // Generate a gradient based on the stage color
    const color = stage.color || '#6366f1';
    return `from-[${color}] to-[${color}]`;
  };

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      {/* Column Header */}
      <div className="glass-card rounded-t-xl p-4 border border-slate-200 dark:border-white/10 border-b-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm">
              {stage.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {deals.length}
            </span>
            {stage.probability > 0 && !stage.is_won && !stage.is_lost && (
              <span className="text-xs text-slate-500">
                {stage.probability}%
              </span>
            )}
          </div>
        </div>
        <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          ${totalValue.toLocaleString()}
        </div>
      </div>

      {/* Cards Container */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 glass rounded-b-xl border border-slate-200 dark:border-white/10 border-t-0 p-3 space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin transition-colors',
          isOver && 'bg-teal-500/5 border-teal-500/30'
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
    </div>
  );
}
