'use client';

import { useCallback, useState } from 'react';
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
  /** Org the list belongs to — required for the "Filter by Owner" advisor list. */
  orgId?: string;
  /** Module key — powers the live status-values picker inside the sidebar. */
  moduleKey?: string;
  className?: string;
}

/**
 * FilterSidebarTrigger -- Button that opens the full FilterSidebar in a centered Dialog.
 *
 * The sidebar edits a local draft; `onFiltersChange` fires once on Apply
 * (Cancel / Escape / backdrop discard the draft), so the list behind the
 * dialog never re-queries mid-edit.
 */
export function FilterSidebarTrigger({
  fields,
  filters,
  onFiltersChange,
  orgId,
  moduleKey,
  className,
}: FilterSidebarTriggerProps) {
  const [open, setOpen] = useState(false);
  const activeCount = filters.length;
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
          className={cn(
            'h-8 text-xs gap-1.5',
            activeCount > 0 && 'border-primary/40 bg-primary/10 text-primary',
            className,
          )}
        >
          <Filter className="w-3.5 h-3.5" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none ml-0.5">
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
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Remounts on each open (Radix unmounts content when closed), so the
              draft always starts from the currently applied filters. */}
          <FilterSidebar
            fields={fields}
            filters={filters}
            onFiltersChange={onFiltersChange}
            onClose={close}
            orgId={orgId}
            moduleKey={moduleKey}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
