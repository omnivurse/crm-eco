'use client';

import { useCallback, useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@crm-eco/ui/components/sheet';
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
  /** Dialog heading, e.g. “Filter Contacts by”. */
  title?: string;
  /**
   * `crm.lists.trim_surface` (LS-9). Forwarded verbatim to the sidebar so the
   * md–lg sheet trims exactly like the docked rail; false keeps today's
   * full surface, which is what an org without the flag row sees.
   */
  trimSurface?: boolean;
  className?: string;
}

/**
 * FilterSidebarTrigger -- Button that opens the full FilterSidebar in a drawer.
 *
 * Same draft-until-Apply contract as the docked rail. A weaker dialog is not
 * used on md–lg.
 */
export function FilterSidebarTrigger({
  fields,
  filters,
  onFiltersChange,
  orgId,
  moduleKey,
  title,
  trimSurface = false,
  className,
}: FilterSidebarTriggerProps) {
  const [open, setOpen] = useState(false);
  const activeCount = filters.length;
  const close = useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
          data-testid="crm-filter-trigger"
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
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col"
      >
        <SheetTitle className="sr-only">{title ?? 'Filters'}</SheetTitle>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <FilterSidebar
            fields={fields}
            filters={filters}
            onFiltersChange={onFiltersChange}
            onClose={close}
            orgId={orgId}
            moduleKey={moduleKey}
            title={title}
            trimSurface={trimSurface}
            variant="docked"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
