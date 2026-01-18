'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@crm-eco/ui/lib/utils';
import { WidgetRenderer } from './WidgetRenderer';
import { WidgetControls } from './WidgetControls';
import { WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry';
import type { WidgetInstance } from '@/lib/dashboard/types';

interface SortableWidgetProps {
  widget: WidgetInstance;
  data: unknown;
  isEditMode: boolean;
}

const sizeToSpan: Record<string, string> = {
  small: 'lg:col-span-2',
  medium: 'lg:col-span-3',
  large: 'lg:col-span-4',
  full: 'lg:col-span-5',
};

export function SortableWidget({ widget, data, isEditMode }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const definition = WIDGET_REGISTRY[widget.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        sizeToSpan[widget.size] || 'lg:col-span-3',
        isDragging && 'opacity-50 z-50',
        isEditMode && 'cursor-grab active:cursor-grabbing'
      )}
    >
      {isEditMode && (
        <WidgetControls
          widget={widget}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      )}
      <WidgetRenderer
        widget={widget}
        data={data}
        isDragging={isDragging}
      />
    </div>
  );
}
