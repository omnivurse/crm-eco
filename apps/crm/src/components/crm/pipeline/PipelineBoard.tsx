'use client';

import { useState, useCallback } from 'react';
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

  // Group deals by stage
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage.key] = deals.filter(d => d.stage === stage.key);
    return acc;
  }, {} as Record<string, CrmRecord[]>);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = deals.find(d => d.id === event.active.id);
    if (deal) {
      setActiveDeal(deal);
    }
  }, [deals]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeDealId = active.id as string;
    const overId = over.id as string;

    // Find the active deal
    const deal = deals.find(d => d.id === activeDealId);
    if (!deal) return;

    // Check if we're over a stage column
    const overStage = stages.find(s => s.key === overId);
    if (overStage && deal.stage !== overStage.key) {
      // Preview the move
      setDeals(prev => prev.map(d => 
        d.id === activeDealId 
          ? { ...d, stage: overStage.key }
          : d
      ));
    }
  }, [deals, stages]);

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
