'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, ChevronDown, ChevronRight, AlertTriangle, Settings2, Loader2 } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Badge } from '@crm-eco/ui/components/badge';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Popover, PopoverContent, PopoverTrigger } from '@crm-eco/ui/components/popover';
import { toast } from 'sonner';
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
  /** Show the WIP-limit settings gear (admins/managers only). */
  canEditStage?: boolean;
  /** Persist a new WIP limit (or null to turn it off). Returns the saved value. */
  onWipLimitChange?: (stageId: string, newLimit: number | null) => Promise<void>;
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
  canEditStage = false,
  onWipLimitChange,
}: StageColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftLimit, setDraftLimit] = useState<string>(
    wipLimit !== undefined ? String(wipLimit) : ''
  );
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const { isOver, setNodeRef } = useDroppable({
    id: stage.key,
  });

  const isOverWipLimit = wipLimit !== undefined && deals.length > wipLimit;
  const isAtWipLimit = wipLimit !== undefined && deals.length === wipLimit;
  const showSettings = canEditStage && !!onWipLimitChange;

  const handleSaveLimit = async (turnOff: boolean) => {
    if (!onWipLimitChange) return;
    let next: number | null = null;
    if (!turnOff) {
      const trimmed = draftLimit.trim();
      if (trimmed === '') {
        next = null;
      } else {
        const n = Math.floor(Number(trimmed));
        if (!Number.isFinite(n) || n < 0) {
          toast.error('Enter a whole number 0 or higher');
          return;
        }
        next = n;
      }
    }
    setIsSavingLimit(true);
    try {
      await onWipLimitChange(stage.id, next);
      toast.success(next === null ? 'Limit turned off' : `Limit set to ${next}`);
      setSettingsOpen(false);
    } catch (err) {
      console.error('Failed to save WIP limit:', err);
      toast.error('Could not save the limit');
    } finally {
      setIsSavingLimit(false);
    }
  };

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
                <span title="Over WIP limit">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </span>
              )}
              {stage.probability > 0 && !stage.is_won && !stage.is_lost && (
                <span className="text-xs text-slate-500">
                  {stage.probability}%
                </span>
              )}
              {showSettings && (
                <Popover
                  open={settingsOpen}
                  onOpenChange={(open) => {
                    setSettingsOpen(open);
                    if (open) {
                      setDraftLimit(wipLimit !== undefined ? String(wipLimit) : '');
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Set a limit for this column"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          Column limit
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Show a warning when this column has more than this many
                          deals. Leave blank or turn off if you don&apos;t want one.
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        placeholder="e.g. 10"
                        value={draftLimit}
                        onChange={(e) => setDraftLimit(e.target.value)}
                        disabled={isSavingLimit}
                        className="h-9"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSavingLimit || wipLimit === undefined}
                          onClick={() => handleSaveLimit(true)}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        >
                          Turn off
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isSavingLimit}
                            onClick={() => setSettingsOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSavingLimit}
                            onClick={() => handleSaveLimit(false)}
                          >
                            {isSavingLimit ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
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
