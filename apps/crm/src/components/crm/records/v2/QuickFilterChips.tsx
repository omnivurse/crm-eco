'use client';

/**
 * Compact row of preset filter chips (Zoho-style). Each preset is a
 * package of filters + optional scope/search overrides that gets merged
 * into the current list state. Toggling a chip re-pushes the URL so the
 * resulting state is shareable.
 *
 * Presets here are intentionally scoped to values that every CRM module
 * shares (owner, activity recency, created timestamp). Module-specific
 * presets still live in `SavedViewsBar`'s `builtInViews` list.
 */

import { memo, useMemo } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Flame, UserCircle2, Clock3, CheckCircle2 } from 'lucide-react';
import type { ViewFilter } from '@/lib/crm/types';

export interface QuickFilterPreset {
  id: string;
  label: string;
  /** Filters merged/replaced on activation. */
  filters: ViewFilter[];
  /** Optional scope override. */
  scope?: 'all' | 'mine' | 'downline';
  /** Icon from lucide-react. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Tooltip shown on hover. */
  hint?: string;
}

const DEFAULT_PRESETS: QuickFilterPreset[] = [
  {
    id: 'mine',
    label: 'My records',
    icon: UserCircle2,
    scope: 'mine',
    filters: [],
    hint: 'Only records where you are the owner',
  },
  {
    id: 'recent-week',
    label: 'Updated this week',
    icon: Clock3,
    filters: [
      { field: 'updated_at', operator: 'this_week', value: null },
    ],
  },
  {
    id: 'new-this-week',
    label: 'Created this week',
    icon: Flame,
    filters: [
      { field: 'created_at', operator: 'this_week', value: null },
    ],
  },
  {
    id: 'closed-won',
    label: 'Closed won',
    icon: CheckCircle2,
    filters: [
      { field: 'status', operator: 'equals', value: 'closed_won' },
    ],
  },
];

export interface QuickFilterChipsProps {
  /** Currently-active filters; used to detect which chip is "on". */
  currentFilters: ViewFilter[];
  /** Current scope override (affects the "My records" chip highlight). */
  currentScope?: 'all' | 'mine' | 'downline';
  onApplyPreset: (preset: QuickFilterPreset, active: boolean) => void;
  /** Override the default set — rarely needed outside tests. */
  presets?: QuickFilterPreset[];
  className?: string;
}

function presetIsActive(
  preset: QuickFilterPreset,
  filters: ViewFilter[],
  scope: 'all' | 'mine' | 'downline' | undefined,
): boolean {
  if (preset.scope && preset.scope !== (scope ?? 'all')) return false;
  if (preset.filters.length === 0) return preset.scope
    ? preset.scope === (scope ?? 'all')
    : false;
  // Loose membership check — a preset is active if every filter it
  // declares is present in the current filter list (match by field +
  // operator, ignore operand so "equals: foo" and "equals: bar" don't
  // appear simultaneously active).
  return preset.filters.every((p) =>
    filters.some(
      (f) => f.field === p.field && f.operator === p.operator,
    ),
  );
}

export const QuickFilterChips = memo(function QuickFilterChips({
  currentFilters,
  currentScope,
  onApplyPreset,
  presets = DEFAULT_PRESETS,
  className,
}: QuickFilterChipsProps) {
  const states = useMemo(
    () =>
      presets.map((p) => ({
        preset: p,
        active: presetIsActive(p, currentFilters, currentScope),
      })),
    [presets, currentFilters, currentScope],
  );

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 flex-wrap',
        className,
      )}
      role="group"
      aria-label="Quick filters"
    >
      {states.map(({ preset, active }) => {
        const Icon = preset.icon;
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.hint}
            onClick={() => onApplyPreset(preset, active)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
              'transition-colors border',
              active
                ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30'
                : 'bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20',
            )}
          >
            {Icon ? <Icon className="w-3 h-3" /> : null}
            {preset.label}
          </button>
        );
      })}
    </div>
  );
});

export const DEFAULT_QUICK_FILTER_PRESETS = DEFAULT_PRESETS;
