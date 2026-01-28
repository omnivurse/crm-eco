'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { StageColumn } from './StageColumn';
import { DealCard } from './DealCard';
import type { CrmRecord, CrmDealStage } from '@/lib/crm/types';

interface PipelineBoardProps {
  deals: CrmRecord[];
  stages: CrmDealStage[];
  onStageChange?: (dealId: string, newStage: string, oldStage: string) => Promise<void>;
  className?: string;
}

export function PipelineBoard({
  deals: initialDeals,
  stages,
  onStageChange,
  className,
}: PipelineBoardProps) {
  const [deals, setDeals] = useState<CrmRecord[]>(initialDeals);
  const [activeDeal, setActiveDeal] = useState<CrmRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Use ref for current deals in callbacks to avoid stale closures and prevent callback recreation
  const dealsRef = useRef(deals);
  dealsRef.current = deals;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Memoize grouped deals by stage - prevents O(stages × deals) recalculation on every render
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, CrmRecord[]> = {};
    // Single pass through deals instead of filter per stage
    for (const stage of stages) {
      grouped[stage.key] = [];
    }
    for (const deal of deals) {
      if (deal.stage && grouped[deal.stage]) {
        grouped[deal.stage].push(deal);
      }
    }
    return grouped;
  }, [deals, stages]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = dealsRef.current.find(d => d.id === event.active.id);
    if (deal) {
      setActiveDeal(deal);
    }
  }, []); // No dependencies - uses ref

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeDealId = active.id as string;
    const overId = over.id as string;

    // Find the active deal
    const deal = dealsRef.current.find(d => d.id === activeDealId);
    if (!deal) return;

    // Check if we're over a stage column
    const overStage = stages.find(s => s.key === overId);
    if (overStage && deal.stage !== overStage.key) {
      // Preview the move with functional update
      setDeals(prev => prev.map(d =>
        d.id === activeDealId
          ? { ...d, stage: overStage.key }
          : d
      ));
    }
  }, [stages]); // Only depends on stages, not deals

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) {
      // Reset if dropped outside
      setDeals(initialDeals);
      return;
    }

    const activeDealId = active.id as string;
    const overId = over.id as string;

    const deal = initialDeals.find(d => d.id === activeDealId);
    if (!deal) return;

    // Determine the new stage
    const overStage = stages.find(s => s.key === overId);
    const newStageKey = overStage ? overStage.key : deal.stage;

    if (newStageKey && newStageKey !== deal.stage && onStageChange) {
      setIsUpdating(activeDealId);
      try {
        await onStageChange(activeDealId, newStageKey, deal.stage || '');
        // Update succeeded, keep the optimistic state
      } catch (error) {
        console.error('Failed to update stage:', error);
        // Revert on error
        setDeals(initialDeals);
      } finally {
        setIsUpdating(null);
      }
    }
  }, [initialDeals, stages, onStageChange]);

  const handleDragCancel = useCallback(() => {
    setActiveDeal(null);
    setDeals(initialDeals);
  }, [initialDeals]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`flex gap-4 min-w-max ${className || ''}`}>
        {stages
          .filter(stage => !stage.is_lost) // Optionally hide closed-lost
          .map((stage) => {
            const stageDeals = dealsByStage[stage.key] || [];
            const totalValue = stageDeals.reduce(
              (sum, d) => sum + (Number(d.data?.amount) || 0),
              0
            );

            return (
              <SortableContext
                key={stage.key}
                id={stage.key}
                items={stageDeals.map(d => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <StageColumn
                  stage={stage}
                  deals={stageDeals}
                  totalValue={totalValue}
                  isUpdating={isUpdating}
                />
              </SortableContext>
            );
          })}
      </div>

      <DragOverlay>
        {activeDeal ? (
          <DealCard deal={activeDeal} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
