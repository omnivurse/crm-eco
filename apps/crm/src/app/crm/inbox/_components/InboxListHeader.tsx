'use client';

/**
 * The bar Outlook puts between the search box and the message list: what the
 * list is sorted by, what the list is hiding, and how to undo both.
 *
 * Sort and filter state belongs to the page (it persists into inbox prefs), so
 * this component holds no state of its own — it reports intent and renders the
 * answer. Keeping it stateless is what lets the same bar drive a list that was
 * shaped on the server on first paint and in memory afterwards.
 */

import React, { useCallback } from 'react';
import { ArrowDown, ArrowUp, ArrowDownUp, ListFilter, MailOpen, X } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  toggleQuickFilter,
  type ConversationSort,
  type ConversationSortField,
  type QuickFilterKey,
  type SortDirection,
} from '@/lib/inbox/inbox-prefs';

const SORT_OPTIONS: ReadonlyArray<{ field: ConversationSortField; label: string }> = [
  { field: 'date', label: 'Date' },
  { field: 'from', label: 'From' },
  { field: 'subject', label: 'Subject' },
  { field: 'unread', label: 'Unread' },
  { field: 'attachments', label: 'Attachments' },
  { field: 'importance', label: 'Importance' },
];

/**
 * Outlook never says "ascending" — it says what ends up on top, which is the
 * only part a reader can verify by looking at the list. The wording tracks
 * `compareBy` in inbox-view-model: every key is written descending-first, so
 * 'desc' really is newest / Z / flagged-first.
 */
const DIRECTION_LABELS: Record<ConversationSortField, Record<SortDirection, string>> = {
  date: { desc: 'Newest on top', asc: 'Oldest on top' },
  from: { desc: 'Z to A', asc: 'A to Z' },
  subject: { desc: 'Z to A', asc: 'A to Z' },
  unread: { desc: 'Unread on top', asc: 'Read on top' },
  attachments: { desc: 'With files on top', asc: 'Without files on top' },
  importance: { desc: 'High on top', asc: 'Low on top' },
};

const FILTER_OPTIONS: ReadonlyArray<{ key: QuickFilterKey; label: string }> = [
  { key: 'unread', label: 'Unread' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'attachments', label: 'Has attachments' },
  { key: 'to_me', label: 'To me' },
  { key: 'important', label: 'Important' },
];

const CONTROL =
  'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white';

export interface InboxListHeaderProps {
  sort: ConversationSort;
  onSortChange: (sort: ConversationSort) => void;
  quickFilters: readonly QuickFilterKey[];
  onQuickFiltersChange: (filters: QuickFilterKey[]) => void;
  onMarkAllRead: () => void;
  /** Rows the Filter menu hid, so the chip can say how much is out of view. */
  filteredOutCount?: number;
  className?: string;
}

export const InboxListHeader = React.memo(function InboxListHeader({
  sort,
  onSortChange,
  quickFilters,
  onQuickFiltersChange,
  onMarkAllRead,
  filteredOutCount = 0,
  className,
}: InboxListHeaderProps) {
  const sortLabel = SORT_OPTIONS.find((o) => o.field === sort.field)?.label ?? 'Date';
  const directionLabel = DIRECTION_LABELS[sort.field][sort.direction];
  const activeFilters = quickFilters.length;

  const selectSort = useCallback(
    (field: ConversationSortField) => {
      // Picking the field you are already on means "the other way round" —
      // Outlook's list header works this way, and it is the only place a
      // direction can be changed without a second menu.
      onSortChange(
        field === sort.field
          ? { field, direction: sort.direction === 'desc' ? 'asc' : 'desc' }
          : { field, direction: 'desc' },
      );
    },
    [onSortChange, sort.direction, sort.field],
  );

  const toggleFilter = useCallback(
    (key: QuickFilterKey) => {
      onQuickFiltersChange(toggleQuickFilter(quickFilters, key));
    },
    [onQuickFiltersChange, quickFilters],
  );

  const clearFilters = useCallback(() => {
    onQuickFiltersChange([]);
  }, [onQuickFiltersChange]);

  const DirectionIcon = sort.direction === 'desc' ? ArrowDown : ArrowUp;

  return (
    <div
      role="toolbar"
      aria-label="Conversation list options"
      className={cn(
        'flex shrink-0 items-center gap-0.5 border-b border-slate-200/80 px-2 py-1 dark:border-white/10',
        className,
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={CONTROL}
            aria-label={`Sort by ${sortLabel}, ${directionLabel}`}
            title={`Sorted by ${sortLabel} — ${directionLabel}`}
          >
            <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Sort:</span>
            <span className="text-slate-900 dark:text-white">{sortLabel}</span>
            <DirectionIcon className="h-3 w-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          {SORT_OPTIONS.map((option) => {
            const active = option.field === sort.field;
            return (
              <DropdownMenuItem
                key={option.field}
                onClick={() => selectSort(option.field)}
                aria-current={active ? 'true' : undefined}
                className={cn('justify-between gap-3', active && 'font-semibold')}
              >
                <span>{option.label}</span>
                {active && (
                  <span className="flex items-center gap-1 text-[11px] font-normal opacity-70">
                    {DIRECTION_LABELS[option.field][sort.direction]}
                    <DirectionIcon className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(CONTROL, activeFilters > 0 && 'text-teal-700 dark:text-teal-300')}
            aria-label={
              activeFilters > 0 ? `Filter, ${activeFilters} active` : 'Filter'
            }
            title="Filter this list"
          >
            <ListFilter className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Filter</span>
            {activeFilters > 0 && (
              <span className="rounded-full bg-teal-600 px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
                {activeFilters}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          {FILTER_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.key}
              checked={quickFilters.includes(option.key)}
              onCheckedChange={() => toggleFilter(option.key)}
              // Filters intersect, so picking one is rarely the whole intent.
              // Closing after the first tick would make "unread with files"
              // a two-trip errand.
              onSelect={(event) => event.preventDefault()}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={clearFilters} disabled={activeFilters === 0}>
            Clear filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeFilters > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 py-0.5 pl-2 pr-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
          Filtered
          {filteredOutCount > 0 && (
            <span className="tabular-nums opacity-70">· {filteredOutCount} hidden</span>
          )}
          <button
            type="button"
            onClick={clearFilters}
            aria-label="Clear filters"
            className="rounded-full p-0.5 transition-colors hover:bg-teal-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={onMarkAllRead}
        className={cn(CONTROL, 'ml-auto')}
        aria-label="Mark all read"
        title="Mark everything in this list as read"
      >
        <MailOpen className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden md:inline">Mark all read</span>
      </button>
    </div>
  );
});
