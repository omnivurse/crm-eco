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
 * Counts: a chip only shows a count badge when it is > 0 — a "0" next to
 * Campaigns/Cadences (empty tables org-wide) reads as content that isn't there.
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
  GitBranch,
  ShoppingBag,
  Megaphone,
  Globe,
  Share2,
  ClipboardList,
  LifeBuoy,
  CalendarCheck,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { RelatedListNavItem } from './RecordRelatedListNav';

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  details: FileText,
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
  cadences: GitBranch,
  products: ShoppingBag,
  campaigns: Megaphone,
  visits: Globe,
  social: Share2,
  surveys: ClipboardList,
  desk: LifeBuoy,
  meetings: CalendarCheck,
  invited_meetings: CalendarCheck,
};

interface ChipAccent {
  /** Solid fill for the selected chip. */
  active: string;
  /** Tinted resting state — keeps each list color-coded at a glance. */
  inactive: string;
  /** Icon tint in the resting state (icon inherits white when active). */
  icon: string;
  /** Count badge tint in the resting state. */
  badge: string;
}

/**
 * Per-list color coding (mirrors the section accent scheme) so reps can find
 * "the amber Notes chip" or "the blue Emails chip" without reading labels.
 */
const CHIP_ACCENTS: Record<string, ChipAccent> = {
  details: {
    active: 'bg-teal-500 text-white border-teal-500 shadow-sm',
    inactive:
      'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-transparent hover:bg-teal-100 dark:hover:bg-teal-500/20',
    icon: 'text-teal-500 dark:text-teal-400',
    badge: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300',
  },
  notes: {
    active: 'bg-amber-500 text-white border-amber-500 shadow-sm',
    inactive:
      'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-transparent hover:bg-amber-100 dark:hover:bg-amber-500/20',
    icon: 'text-amber-500 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
  },
  emails: {
    active: 'bg-primary text-primary-foreground border-primary shadow-sm',
    inactive:
      'bg-primary/10 text-primary border-transparent hover:bg-primary/15',
    icon: 'text-primary',
    badge: 'bg-primary/15 text-primary',
  },
  open_activities: {
    active: 'bg-cyan-500 text-white border-cyan-500 shadow-sm',
    inactive:
      'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-transparent hover:bg-cyan-100 dark:hover:bg-cyan-500/20',
    icon: 'text-cyan-500 dark:text-cyan-400',
    badge: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
  },
  closed_activities: {
    active: 'bg-emerald-500 text-white border-emerald-500 shadow-sm',
    inactive:
      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-transparent hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
    icon: 'text-emerald-500 dark:text-emerald-400',
    badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  },
  attachments: {
    active: 'bg-violet-500 text-white border-violet-500 shadow-sm',
    inactive:
      'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-transparent hover:bg-violet-100 dark:hover:bg-violet-500/20',
    icon: 'text-violet-500 dark:text-violet-400',
    badge: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
  },
  connected: {
    active: 'bg-indigo-500 text-white border-indigo-500 shadow-sm',
    inactive:
      'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-transparent hover:bg-indigo-100 dark:hover:bg-indigo-500/20',
    icon: 'text-indigo-500 dark:text-indigo-400',
    badge: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
  },
  campaigns: {
    active: 'bg-pink-500 text-white border-pink-500 shadow-sm',
    inactive:
      'bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-300 border-transparent hover:bg-pink-100 dark:hover:bg-pink-500/20',
    icon: 'text-pink-500 dark:text-pink-400',
    badge: 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300',
  },
  cadences: {
    active: 'bg-purple-500 text-white border-purple-500 shadow-sm',
    inactive:
      'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-transparent hover:bg-purple-100 dark:hover:bg-purple-500/20',
    icon: 'text-purple-500 dark:text-purple-400',
    badge: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300',
  },
  products: {
    active: 'bg-orange-500 text-white border-orange-500 shadow-sm',
    inactive:
      'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-transparent hover:bg-orange-100 dark:hover:bg-orange-500/20',
    icon: 'text-orange-500 dark:text-orange-400',
    badge: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300',
  },
  visits: {
    active: 'bg-sky-500 text-white border-sky-500 shadow-sm',
    inactive:
      'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-transparent hover:bg-sky-100 dark:hover:bg-sky-500/20',
    icon: 'text-sky-500 dark:text-sky-400',
    badge: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300',
  },
  social: {
    active: 'bg-fuchsia-500 text-white border-fuchsia-500 shadow-sm',
    inactive:
      'bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-transparent hover:bg-fuchsia-100 dark:hover:bg-fuchsia-500/20',
    icon: 'text-fuchsia-500 dark:text-fuchsia-400',
    badge: 'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300',
  },
  invited_meetings: {
    active: 'bg-rose-500 text-white border-rose-500 shadow-sm',
    inactive:
      'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-transparent hover:bg-rose-100 dark:hover:bg-rose-500/20',
    icon: 'text-rose-500 dark:text-rose-400',
    badge: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300',
  },
};

// Aliases share their canonical list's accent.
CHIP_ACCENTS.overview = CHIP_ACCENTS.details;
CHIP_ACCENTS.communications = CHIP_ACCENTS.emails;
CHIP_ACCENTS.activities = CHIP_ACCENTS.open_activities;
CHIP_ACCENTS.files = CHIP_ACCENTS.attachments;
CHIP_ACCENTS.related = CHIP_ACCENTS.connected;
CHIP_ACCENTS.meetings = CHIP_ACCENTS.invited_meetings;

const DEFAULT_CHIP_ACCENT: ChipAccent = {
  active: 'bg-teal-500 text-white border-teal-500 shadow-sm',
  inactive:
    'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800',
  icon: 'text-slate-400 dark:text-slate-500',
  badge: 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200',
};

export interface RecordRelatedListChipsProps {
  items: RelatedListNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onMore?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const RecordRelatedListChips = memo(function RecordRelatedListChips({
  items,
  activeId,
  onSelect,
  onMore,
  className,
  style,
}: RecordRelatedListChipsProps) {
  const activeChipRef = useRef<HTMLButtonElement>(null);

  const visibleItems = items.filter((i) => i.available || i.id === activeId);

  const chipScrollerRef = useRef<HTMLDivElement>(null);

  // Keep the active chip visible horizontally only. Avoid scrollIntoView —
  // Chromium/Brave can still scroll ancestor overflow-y containers and jerk
  // the record page when the chips live inside the sticky header.
  useEffect(() => {
    const chip = activeChipRef.current;
    const scroller = chipScrollerRef.current;
    if (!chip || !scroller) return;
    const target =
      chip.offsetLeft - (scroller.clientWidth - chip.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeId]);

  // Arrow-key roving focus (WAI-ARIA tabs). Enter/Space activate via onClick.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t === document.activeElement);
    let next = idx;
    if (e.key === 'ArrowLeft') next = idx <= 0 ? tabs.length - 1 : idx - 1;
    if (e.key === 'ArrowRight') next = idx >= tabs.length - 1 ? 0 : idx + 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    e.preventDefault();
    tabs[next]?.focus();
  };

  return (
    <div
      ref={chipScrollerRef}
      role="tablist"
      aria-label="Related lists"
      onKeyDown={handleKeyDown}
      style={style}
      className={cn(
        'relative flex items-center gap-1.5 overflow-x-auto scrollbar-thin px-4 py-2 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950',
        className,
      )}
    >
      {visibleItems.map((item) => {
        const Icon = ICONS[item.id] || Link2;
        const isActive = activeId === item.id;
        const accent = CHIP_ACCENTS[item.id] ?? DEFAULT_CHIP_ACCENT;
        return (
          <button
            key={item.id}
            ref={isActive ? activeChipRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(item.id)}
            className={cn(
              'inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? accent.active : accent.inactive,
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', !isActive && accent.icon)} />
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 ? (
              <span
                className={cn(
                  'ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold',
                  isActive ? 'bg-white/25 text-white' : accent.badge,
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
