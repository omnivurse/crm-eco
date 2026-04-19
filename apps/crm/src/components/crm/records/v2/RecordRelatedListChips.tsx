'use client';

/**
 * RecordRelatedListChips — horizontal, swipeable version of
 * `RecordRelatedListNav` used on narrow viewports where the vertical rail
 * would eat too much real estate.
 *
 * Renders only the items that are either active, selected, or flagged as
 * `available`. "Coming soon" entries are dropped on mobile — the customize
 * dialog remains the canonical surface for turning them on later.
 *
 * Scroll behavior: auto-scrolls the active chip into view when it changes,
 * so programmatic tab switches (e.g., from the command palette) don't
 * leave the user staring at a chip that's off-screen.
 */

import { memo, useEffect, useRef, type ComponentType } from 'react';
import {
  StickyNote,
  Mail,
  CheckSquare,
  CheckCircle2,
  Paperclip,
  Link2,
  FileText,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { RelatedListNavItem } from './RecordRelatedListNav';

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  overview: FileText,
  notes: StickyNote,
  emails: Mail,
  communications: Mail,
  activities: CheckSquare,
  open_activities: CheckSquare,
  closed_activities: CheckCircle2,
  attachments: Paperclip,
  files: Paperclip,
  related: Link2,
  connected: Link2,
};

export interface RecordRelatedListChipsProps {
  items: RelatedListNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onMore?: () => void;
  className?: string;
}

export const RecordRelatedListChips = memo(function RecordRelatedListChips({
  items,
  activeId,
  onSelect,
  onMore,
  className,
}: RecordRelatedListChipsProps) {
  const activeChipRef = useRef<HTMLButtonElement>(null);

  const visibleItems = items.filter((i) => i.available || i.id === activeId);

  // Keep the active chip visible. We use scrollIntoView with `inline: 'center'`
  // so the selected tab feels centered on mobile even after long scrolls.
  useEffect(() => {
    if (!activeChipRef.current) return;
    activeChipRef.current.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [activeId]);

  return (
    <div
      role="tablist"
      aria-label="Record sections"
      className={cn(
        'relative flex items-center gap-1.5 overflow-x-auto scrollbar-thin px-4 py-2 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-950/80 backdrop-blur',
        className,
      )}
    >
      {visibleItems.map((item) => {
        const Icon = ICONS[item.id] || Link2;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            ref={isActive ? activeChipRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(item.id)}
            className={cn(
              'inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
              isActive
                ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 ? (
              <span
                className={cn(
                  'ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold',
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}

      {onMore ? (
        <button
          type="button"
          onClick={onMore}
          className="inline-flex items-center gap-1 shrink-0 px-2 py-1.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
          aria-label="Customize related lists"
          title="Customize"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
});
