'use client';

import { useState } from 'react';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext';
import { WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry';
import type { WidgetInstance, WidgetSize } from '@/lib/dashboard/types';

interface WidgetControlsProps {
  widget: WidgetInstance;
  dragHandleProps: Record<string, unknown>;
}

const sizeLabels: Record<WidgetSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  full: 'Full Width',
};

export function WidgetControls({ widget, dragHandleProps }: WidgetControlsProps) {
  const { removeWidget, resizeWidget } = useDashboardLayout();
  const definition = WIDGET_REGISTRY[widget.type];
  const allowedSizes = definition?.allowedSizes || ['small', 'medium', 'large', 'full'];

  return (
    <div className="absolute -top-3 left-0 right-0 z-10 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/90 backdrop-blur-sm text-white text-xs font-medium cursor-grab active:cursor-grabbing hover:bg-slate-700 transition-colors shadow-lg"
      >
        <GripVertical className="w-3.5 h-3.5" />
        <span>Drag</span>
      </button>

      <div className="flex items-center gap-1">
        {/* Resize dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/90 backdrop-blur-sm text-white text-xs font-medium hover:bg-slate-700 transition-colors shadow-lg">
              {widget.size === 'small' || widget.size === 'medium' ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
              <span>{sizeLabels[widget.size]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {allowedSizes.map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => resizeWidget(widget.id, size)}
                className={cn(
                  'cursor-pointer',
                  widget.size === size && 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                )}
              >
                {sizeLabels[size]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Remove button */}
        <button
          onClick={() => removeWidget(widget.id)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-600/90 backdrop-blur-sm text-white text-xs font-medium hover:bg-red-500 transition-colors shadow-lg"
        >
          <X className="w-3.5 h-3.5" />
          <span>Remove</span>
        </button>
      </div>
    </div>
  );
}
