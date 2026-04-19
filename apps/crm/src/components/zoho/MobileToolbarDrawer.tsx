'use client';

/**
 * MobileToolbarDrawer — a bottom `Sheet` that reveals the full list-page
 * toolbar on narrow viewports.
 *
 * ModuleShell renders the regular desktop toolbar inside a compact summary
 * row at the top, and offloads the heavier controls (view-mode switcher,
 * scope, saved views, filters, columns, density) into this drawer so they
 * don't wrap into a multi-line mess on phones.
 *
 * The drawer is intentionally a thin, presentation-only wrapper. ModuleShell
 * passes the actual JSX for each section as children, which keeps the state
 * owned by the parent and avoids a parallel render tree.
 */

import { memo, type ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@crm-eco/ui/components/sheet';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

export interface MobileToolbarDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional counter badge next to the title (e.g. active filter count). */
  activeCount?: number;
  sections: Array<{
    id: string;
    label: string;
    content: ReactNode;
  }>;
  className?: string;
}

export const MobileToolbarDrawer = memo(function MobileToolbarDrawer({
  open,
  onOpenChange,
  activeCount,
  sections,
  className,
}: MobileToolbarDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10',
          className,
        )}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <SlidersHorizontal className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Filters & View
            {typeof activeCount === 'number' && activeCount > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-teal-500 text-white text-[10px] font-bold">
                {activeCount}
              </span>
            ) : null}
          </SheetTitle>
          <SheetDescription className="text-slate-500 dark:text-slate-400">
            Change how records are displayed, filtered, and sorted.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5 pb-6">
          {sections.map((section) => (
            <div key={section.id} className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.label}
              </div>
              <div>{section.content}</div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
});
