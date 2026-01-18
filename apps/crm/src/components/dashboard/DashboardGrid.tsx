'use client';

import { useState, useCallback } from 'react';
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
import { WidgetRenderer } from './WidgetRenderer';
import { WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry';

interface DashboardGridProps {
  widgetData: Record<string, unknown>;
}

export function DashboardGrid({ widgetData }: DashboardGridProps) {
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
  const activeDefinition = activeWidget
    ? WIDGET_REGISTRY[activeWidget.type]
    : null;

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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {layout.widgets.map((widget) => {
            const definition = WIDGET_REGISTRY[widget.type];
            const dataKey = definition?.dataKey;
            return (
              <SortableWidget
                key={widget.id}
                widget={widget}
                data={dataKey ? widgetData[dataKey] : null}
                isEditMode={isEditMode}
              />
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeWidget && activeDefinition ? (
          <div className="opacity-90 scale-105 shadow-2xl rotate-2">
            <WidgetRenderer
              widget={activeWidget}
              data={
                activeDefinition.dataKey
                  ? widgetData[activeDefinition.dataKey]
                  : null
              }
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
