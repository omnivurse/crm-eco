'use client';

import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@crm-eco/ui/lib/utils';
import { WidgetControls } from './WidgetControls';
import type { WidgetInstance } from '@/lib/dashboard/types';

interface SortableWidgetProps {
  widget: WidgetInstance;
  isEditMode: boolean;
  /** Pre-rendered widget content from server */
  children: ReactNode;
}

const sizeToSpan: Record<string, string> = {
  small: 'lg:col-span-2',
  medium: 'lg:col-span-3',
  large: 'lg:col-span-4',
  full: 'lg:col-span-5',
};

export function SortableWidget({ widget, isEditMode, children }: SortableWidgetProps) {
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
      <div className={cn(
        'h-full transition-all duration-200',
        isDragging && 'ring-2 ring-teal-500 ring-offset-2'
      )}>
        {children}
      </div>
    </div>
  );
}
