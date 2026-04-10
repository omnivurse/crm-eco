'use client';

import { useState, useCallback, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext';
import { SortableWidget } from './SortableWidget';

interface DashboardGridProps {
  /** Pre-rendered widget content keyed by widget ID */
  renderedWidgets: Record<string, ReactNode>;
}

export function DashboardGrid({ renderedWidgets }: DashboardGridProps) {
  const { layout, reorderWidgets, isEditMode } = useDashboardLayout();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (over && active.id !== over.id) {
        reorderWidgets(active.id as string, over.id as string);
      }
    },
    [reorderWidgets]
  );

  const activeWidget = layout.widgets.find((w) => w.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={layout.widgets.map((w) => w.id)}
        strategy={rectSortingStrategy}
        disabled={!isEditMode}
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {layout.widgets.map((widget) => (
            <SortableWidget
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
            >
              {renderedWidgets[widget.id]}
            </SortableWidget>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeWidget ? (
          <div className="opacity-90 scale-105 shadow-2xl rotate-2">
            {renderedWidgets[activeWidget.id]}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
