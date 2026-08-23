'use client';

/**
 * Compact row of preset filter chips (Zoho-style). Each preset is a
 * package of filters + optional scope/search overrides that gets merged
 * into the current list state. Toggling a chip re-pushes the URL so the
 * resulting state is shareable.
 *
 * Two kinds of chip:
 *   - plain presets (owner scope, created/updated windows, exact status)
 *   - LANE chips ("Active", "Pending", "Cancelled", "New", "In process") —
 *     read-side buckets over the client's free-text statuses
 *     (lib/crm/status-lanes). A lane chip fetches the module's distinct raw
 *     status values ONCE (GET /api/crm/records/status-values), shows the
 *     lane's count, and applies `status IN (raw values in lane)` — so the
 *     number on the chip is the number in the list, without touching data.
 *     The fetch is the shared, cached lib/crm/status-values-client (same
 *     request as the Filters sidebar and bulk Change Status). A lane with
 *     no raw values renders a disabled "0" chip — never an empty `in ()`.
 *
 * `moduleKey` / `fields` are optional: without them the component renders
 * the module-agnostic default presets exactly as before.
 */

import { memo, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Flame,
  UserCircle2,
  Clock3,
  CheckCircle2,
  Hourglass,
  XCircle,
  CalendarPlus,
  Sparkles,
  RefreshCw,
  ArrowRightCircle,
} from 'lucide-react';
import type { CrmField, ViewFilter } from '@/lib/crm/types';
import {
  laneCount,
  laneFilter,
  laneFilterFieldForModule,
  statusLaneLabel,
  type LaneFilter,
  type StatusLane,
  type StatusValueCount,
} from '@/lib/crm/status-lanes';
import { useStatusValues } from '@/lib/crm/status-values-client';
import { readListQueryState, recordNounFromModuleKey, type ListQueryState } from '@/lib/crm/list-empty-state';

export interface QuickFilterSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QuickFilterPreset {
  id: string;
  label: string;
  /** Filters merged/replaced on activation. */
  filters: ViewFilter[];
  /** Optional scope override. */
  scope?: 'all' | 'mine' | 'downline';
  /**
   * Optional sort applied with the chip (D2 / TE-3b). Same URL contract the
   * desk's `pendingContactsHref` writes (`sortField` + `sortDirection`) so
   * the chip lands on the same list the desk links to.
   */
  sort?: QuickFilterSort;
  /** Icon from lucide-react. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Tooltip shown on hover. */
  hint?: string;
  /**
   * When set this is a LANE chip: `filters` are derived from the module's
   * raw status values at render time and a count is shown.
   */
  lane?: StatusLane;
}

const MINE_PRESET: QuickFilterPreset = {
  id: 'mine',
  label: 'My records',
  icon: UserCircle2,
  scope: 'mine',
  filters: [],
  hint: 'Only records where you are the owner',
};

const UPDATED_THIS_WEEK_PRESET: QuickFilterPreset = {
  id: 'recent-week',
  label: 'Updated this week',
  icon: Clock3,
  filters: [{ field: 'updated_at', operator: 'this_week', value: null }],
};

const CREATED_THIS_WEEK_PRESET: QuickFilterPreset = {
  id: 'new-this-week',
  label: 'Created this week',
  icon: Flame,
  filters: [{ field: 'created_at', operator: 'this_week', value: null }],
};

const CLOSED_WON_PRESET: QuickFilterPreset = {
  id: 'closed-won',
  label: 'Closed won',
  icon: CheckCircle2,
  filters: [{ field: 'status', operator: 'equals', value: 'closed_won' }],
};

/** Module-agnostic defaults (used when no `moduleKey` is supplied). */
const DEFAULT_PRESETS: QuickFilterPreset[] = [
  MINE_PRESET,
  UPDATED_THIS_WEEK_PRESET,
  CREATED_THIS_WEEK_PRESET,
];

function lanePreset(
  lane: StatusLane,
  icon: QuickFilterPreset['icon'],
  hint: string,
  sort?: QuickFilterSort,
): QuickFilterPreset {
  return { id: `lane-${lane}`, label: statusLaneLabel(lane), icon, filters: [], lane, hint, ...(sort ? { sort } : {}) };
}

/**
 * The Pending lane is a waiting list: oldest first, so the person who has
 * waited longest is the first row — mirrors the desk's `pendingContactsHref`
 * (command-desk-format.ts) which sorts `created_at asc`.
 */
export const PENDING_LANE_SORT: QuickFilterSort = { field: 'created_at', direction: 'asc' };

/**
 * Per-module preset rows. Lane chips get their filters filled in from the
 * status-values API; everything else is static.
 */
export function presetsForModule(moduleKey: string | null | undefined): QuickFilterPreset[] {
  switch (moduleKey) {
    case 'contacts':
    case 'members':
      return [
        lanePreset('active', CheckCircle2, 'Every spelling of an active status'),
        lanePreset('pending', Hourglass, 'Approved / pending — waiting on a start date · oldest first', PENDING_LANE_SORT),
        lanePreset('cancelled', XCircle, 'Cancelled, terminated, deceased and cancellations in flight'),
        {
          id: 'enrolled-this-month',
          label: 'Enrolled this month',
          icon: CalendarPlus,
          filters: [{ field: 'created_at', operator: 'this_month', value: null }],
          hint: 'Records created this calendar month',
        },
        MINE_PRESET,
      ];
    case 'leads':
      return [
        lanePreset('new', Sparkles, 'New leads and prospects'),
        lanePreset('in_process', RefreshCw, 'Applications in process'),
        {
          id: 'converted',
          label: 'Converted',
          icon: ArrowRightCircle,
          filters: [{ field: 'status', operator: 'equals', value: 'Converted' }],
          hint: 'Leads already converted to a contact',
        },
        MINE_PRESET,
      ];
    case 'deals':
      return [...DEFAULT_PRESETS, CLOSED_WON_PRESET];
    default:
      return DEFAULT_PRESETS;
  }
}

export interface QuickFilterChipsProps {
  /** Currently-active filters; used to detect which chip is "on". */
  currentFilters: ViewFilter[];
  /** Current scope override (affects the "My records" chip highlight). */
  currentScope?: 'all' | 'mine' | 'downline';
  onApplyPreset: (preset: QuickFilterPreset, active: boolean) => void;
  /** Override the default set — rarely needed outside tests. */
  presets?: QuickFilterPreset[];
  /** Module key — selects the per-module preset row and enables lane chips. */
  moduleKey?: string;
  /** Module fields — used to pick the status filter field (`contact_status` vs `status`). */
  fields?: CrmField[];
  /**
   * Filter count of the active saved view. When known, an explicit `?view=`
   * only counts as narrowing when the view actually filters (same rule as
   * `useListEmptyState`); when unknown the URL presence of `?view=` decides.
   */
  activeViewFilterCount?: number | null;
  className?: string;
}

/** Filters on these keys ARE the lane — they never make a lane count "narrowed". */
const STATUS_FILTER_FIELDS: ReadonlySet<string> = new Set(['status', 'contact_status', 'lead_status']);

/**
 * LS-5 / D11 (option A): the lane counts are module-wide, so when anything
 * ELSE narrows the list (search, scope, territory, a filtering saved view, a
 * non-status filter) the chip number is no longer "the number in the list".
 * True when that is the case — the chip then mutes its count and says
 * "of all {noun}". A lane chip's own `status in (…)` filter is not narrowing
 * (clicking Pending still shows 32 = the 32 rows it opens).
 */
export function laneCountsAreNarrowed(input: {
  query: Pick<ListQueryState, 'search' | 'scope' | 'territory' | 'viewId'>;
  currentFilters: ViewFilter[];
  activeViewFilterCount?: number | null;
}): boolean {
  const { query, currentFilters, activeViewFilterCount } = input;
  if (query.search.length > 0) return true;
  if (query.scope !== 'all') return true;
  if (query.territory !== null) return true;
  if (query.viewId !== null) {
    if (typeof activeViewFilterCount !== 'number' || activeViewFilterCount > 0) return true;
  }
  return currentFilters.some((f) => !STATUS_FILTER_FIELDS.has(f.field));
}

/** "32 of all contacts" — the muted-count explanation (title + screen readers). */
export function laneCountOfAllLabel(count: number, moduleKey: string | undefined): string {
  return `${count.toLocaleString()} of all ${recordNounFromModuleKey(moduleKey)}`;
}

function sameStringSet(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(String));
  return b.every((v) => sa.has(String(v)));
}

export function presetIsActive(
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
  // appear simultaneously active). Lane chips share field+operator
  // (`status in [...]`), so for `in` filters the value SET must match too.
  return preset.filters.every((p) =>
    filters.some(
      (f) =>
        f.field === p.field &&
        f.operator === p.operator &&
        (p.operator !== 'in' || sameStringSet(f.value, p.value)),
    ),
  );
}

/** Resolve a lane chip into a concrete preset (filters + count) once values are known. */
export function resolveLanePreset(
  preset: QuickFilterPreset,
  values: StatusValueCount[],
  field: LaneFilter['field'],
): { preset: QuickFilterPreset; count: number } {
  if (!preset.lane) return { preset, count: 0 };
  const filter = laneFilter(preset.lane, values.map((v) => v.value), field);
  return {
    preset: { ...preset, filters: [filter] },
    count: laneCount(values, preset.lane),
  };
}

/**
 * True when a resolved lane chip has nothing to filter on: no raw status
 * spelling buckets to the lane (or the lane counts to 0). Such a chip renders
 * disabled with a "0" badge instead of applying an empty `in` filter (which
 * would blank the list).
 */
export function laneIsEmpty(resolved: { preset: QuickFilterPreset; count: number }): boolean {
  if (!resolved.preset.lane) return false;
  if (resolved.count <= 0) return true;
  const filter = resolved.preset.filters[0];
  const values = filter && filter.operator === 'in' && Array.isArray(filter.value) ? filter.value : [];
  return values.length === 0;
}

function statusFieldFor(moduleKey: string | undefined, fields: CrmField[] | undefined): LaneFilter['field'] {
  if (fields?.some((f) => f.key === 'contact_status')) return 'contact_status';
  if (fields?.some((f) => f.key === 'status')) return 'status';
  return laneFilterFieldForModule(moduleKey);
}

export const QuickFilterChips = memo(function QuickFilterChips({
  currentFilters,
  currentScope,
  onApplyPreset,
  presets,
  moduleKey,
  fields,
  activeViewFilterCount,
  className,
}: QuickFilterChipsProps) {
  const basePresets = useMemo(
    () => presets ?? presetsForModule(moduleKey),
    [presets, moduleKey],
  );
  const hasLaneChips = basePresets.some((p) => Boolean(p.lane));
  const valuesState = useStatusValues(moduleKey, hasLaneChips);
  const statusField = useMemo(() => statusFieldFor(moduleKey, fields), [moduleKey, fields]);
  const searchParams = useSearchParams();
  const narrowed = useMemo(
    () =>
      hasLaneChips &&
      laneCountsAreNarrowed({
        query: readListQueryState(searchParams),
        currentFilters,
        activeViewFilterCount,
      }),
    [hasLaneChips, searchParams, currentFilters, activeViewFilterCount],
  );

  const states = useMemo(
    () =>
      basePresets.map((p) => {
        if (!p.lane) {
          return {
            preset: p,
            active: presetIsActive(p, currentFilters, currentScope),
            count: null as number | null,
            disabled: false,
          };
        }
        if (valuesState.status !== 'ready') {
          return { preset: p, active: false, count: null as number | null, disabled: true };
        }
        const resolved = resolveLanePreset(p, valuesState.values, statusField);
        // No raw spelling buckets to this lane → nothing to filter on. Show
        // the honest "0" but never apply `{ operator: 'in', value: [] }`.
        const empty = laneIsEmpty(resolved);
        return {
          preset: resolved.preset,
          active: empty ? false : presetIsActive(resolved.preset, currentFilters, currentScope),
          count: resolved.count as number | null,
          disabled: empty,
        };
      }),
    [basePresets, currentFilters, currentScope, valuesState.status, valuesState.values, statusField],
  );

  return (
    <div
      className={cn('flex items-center gap-1.5 flex-wrap', className)}
      role="group"
      aria-label="Quick filters"
    >
      {states.map(({ preset, active, count, disabled }) => {
        const Icon = preset.icon;
        const loading = disabled && valuesState.status === 'loading';
        const errored = disabled && valuesState.status === 'error';
        // Loaded, but the lane has no raw values (count 0) — inert chip.
        const empty = disabled && valuesState.status === 'ready';
        // LS-5 option A: a module-wide count on a narrowed list says so.
        const ofAll = narrowed && count !== null && !disabled ? laneCountOfAllLabel(count, moduleKey) : null;
        return (
          <button
            key={preset.id}
            type="button"
            data-testid="crm-lane-chip"
            data-lane={preset.id}
            data-count-scope={ofAll ? 'module' : undefined}
            title={
              errored
                ? 'Status counts unavailable — retry'
                : loading
                  ? `${preset.label} — loading counts…`
                  : empty
                    ? `${preset.label} — no records with this status`
                    : ofAll
                      ? `${preset.hint ? `${preset.hint} · ` : ''}${ofAll}, not only this list`
                      : preset.hint
            }
            aria-pressed={active}
            aria-busy={loading || undefined}
            aria-disabled={loading || empty || undefined}
            onClick={
              empty
                ? undefined
                : () => {
                    if (loading) return;
                    if (errored) {
                      valuesState.retry();
                      return;
                    }
                    onApplyPreset(preset, active);
                  }
            }
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
              'transition-colors border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30'
                : 'bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20',
              loading && 'opacity-60 cursor-progress',
              errored && 'border-dashed',
              empty && 'opacity-60 cursor-not-allowed hover:text-slate-600 dark:hover:text-slate-400 hover:border-slate-200 dark:hover:border-white/10',
            )}
          >
            {Icon ? <Icon className="w-3 h-3" aria-hidden="true" /> : null}
            {preset.label}
            {count !== null ? (
              <span
                className={cn(
                  'ml-0.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1 py-px text-[10px] font-semibold tabular-nums',
                  active
                    ? 'bg-teal-100/80 dark:bg-teal-500/20'
                    : 'bg-slate-100 dark:bg-white/10',
                  ofAll && 'opacity-60 font-medium',
                )}
                data-testid="crm-lane-chip-count"
              >
                {count.toLocaleString()}
                {ofAll ? <span className="sr-only"> of all {recordNounFromModuleKey(moduleKey)}</span> : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});

export const DEFAULT_QUICK_FILTER_PRESETS = DEFAULT_PRESETS;
