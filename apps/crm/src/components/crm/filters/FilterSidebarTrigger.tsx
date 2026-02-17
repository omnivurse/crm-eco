'use client';

import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@crm-eco/ui/components/sheet';
import { cn } from '@crm-eco/ui/lib/utils';
import { FilterSidebar } from './FilterSidebar';
import type { CrmField, ViewFilter } from '@/lib/crm/types';

interface FilterSidebarTriggerProps {
  fields: CrmField[];
  filters: ViewFilter[];
  onFiltersChange: (filters: ViewFilter[]) => void;
  className?: string;
}

/**
 * FilterSidebarTrigger -- Button that opens the full FilterSidebar in a Sheet.
 * Replaces the popover-based AdvancedFilterBuilder in ModuleShell.
 */
export function FilterSidebarTrigger({
  fields,
  filters,
  onFiltersChange,
  className,
}: FilterSidebarTriggerProps) {
  const [open, setOpen] = useState(false);
  const activeCount = filters.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 text-xs gap-1.5',
            activeCount > 0 && 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
            className,
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none ml-0.5">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[380px] sm:w-[420px] p-0 flex flex-col"
      >
        <FilterSidebar
          fields={fields}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      </SheetContent>
    </Sheet>
  );
}
