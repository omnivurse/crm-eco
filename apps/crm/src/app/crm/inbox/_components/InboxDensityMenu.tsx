'use client';

/**
 * View options — Outlook's "View settings" reduced to the three that actually
 * change how the mail reads: row density, which end of a thread is newest, and
 * whether the CRM navigation gets out of the way.
 *
 * Stateless. Every choice is a per-user preference owned by the page.
 */

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { Settings2 } from 'lucide-react';
import type { InboxDensity, ThreadOrder } from '@/lib/inbox/inbox-prefs';

const DENSITIES: Array<{ value: InboxDensity; label: string; hint: string }> = [
  { value: 'compact', label: 'Compact', hint: 'Two lines per message' },
  { value: 'cozy', label: 'Cozy', hint: 'Adds a preview line' },
  { value: 'comfortable', label: 'Comfortable', hint: 'Roomiest rows' },
];

const ORDERS: Array<{ value: ThreadOrder; label: string; hint: string }> = [
  { value: 'newest_first', label: 'Newest on top', hint: 'Latest reply opens first' },
  { value: 'oldest_first', label: 'Oldest on top', hint: 'Read a thread as a story' },
];

interface InboxDensityMenuProps {
  density: InboxDensity;
  onDensityChange: (density: InboxDensity) => void;
  threadOrder: ThreadOrder;
  onThreadOrderChange: (order: ThreadOrder) => void;
  collapseNav: boolean;
  onCollapseNavChange: (collapse: boolean) => void;
}

function Label({ text, hint }: { text: string; hint: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[13px] leading-tight">{text}</span>
      <span className="text-[11px] leading-tight text-slate-400">{hint}</span>
    </span>
  );
}

export function InboxDensityMenu({
  density,
  onDensityChange,
  threadOrder,
  onThreadOrderChange,
  collapseNav,
  onCollapseNavChange,
}: InboxDensityMenuProps) {
  // Non-modal because density (below) keeps the menu open to be compared against
  // the live list, and a modal menu would put a click-blocking overlay over that
  // very list — the next click anywhere in the inbox would be swallowed
  // dismissing the menu instead of doing what the user aimed at.
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-white"
          aria-label="View options"
          title="View options"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[232px]">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-slate-400">
          Message list
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={density}
          onValueChange={(value) => onDensityChange(value as InboxDensity)}
        >
          {DENSITIES.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              // The one control worth staying open for: the rows resize behind
              // the menu, so three densities can be compared in three clicks
              // instead of three round trips through the trigger.
              onSelect={(event) => event.preventDefault()}
            >
              <Label text={option.label} hint={option.hint} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-slate-400">
          Conversation order
        </DropdownMenuLabel>
        {/* These two close on select, unlike density: both re-arrange the pane
            the menu is sitting on top of, so staying open would hide the very
            change the user just asked for. */}
        <DropdownMenuRadioGroup
          value={threadOrder}
          onValueChange={(value) => onThreadOrderChange(value as ThreadOrder)}
        >
          {ORDERS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <Label text={option.label} hint={option.hint} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-slate-400">
          Layout
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={collapseNav}
          onCheckedChange={onCollapseNavChange}
        >
          <Label text="Collapse CRM menu here" hint="Give the mail the full width" />
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
