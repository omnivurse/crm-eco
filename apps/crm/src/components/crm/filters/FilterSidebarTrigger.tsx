'use client';

import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@crm-eco/ui/components/dialog';
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
 * FilterSidebarTrigger -- Button that opens the full FilterSidebar in a centered Dialog.
 * Opens the FilterSidebar dialog for composing advanced filters.
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
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
      </DialogTrigger>
      <DialogContent
        hideCloseButton
        className="sm:max-w-[600px] md:max-w-[700px] p-0 max-h-[85vh] overflow-hidden flex flex-col"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Filters</DialogTitle>
        <div className="flex-1 overflow-y-auto">
          <FilterSidebar
            fields={fields}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
