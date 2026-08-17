'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bookmark,
  Plus,
  Trash2,
  Star,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';
import { toastItemDeletedWithUndo } from '@/lib/crm/undo-delete';

/**
 * Personal saved views (`saved_views` table, `/api/crm/saved-views`).
 *
 * This file is the single home for the personal-view primitives so both the
 * legacy `SavedViewsBar` and the unified `ViewsDropdown` (row-1 "Views"
 * control in ModuleShell) share ONE fetch/save/apply/delete implementation:
 *
 *   - `useSavedViews(pageKey)`         fetch + delete + refresh
 *   - `resolveSavedViewApplication()`  legacy / v2 blob → what to apply
 *   - `getBuiltInSavedViews(fields)`   quick views, only where their fields exist
 *   - `SaveViewDialog`                 the "Save current view" dialog
 *   - `SavedViewsBar`                  the original bookmark bar (kept for reuse)
 */

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown> | unknown[];
  page_key: string;
  is_default: boolean;
  created_at: string;
}

export interface SavedViewFilter {
  field: string;
  operator: string;
  value: string | number | boolean | string[] | null;
}

/** @deprecated alias kept for callers that imported the loose local type. */
type ViewFilter = SavedViewFilter;

/**
 * Captured view-state shape used when saving the FULL list UI state
 * (not just filters). Detected on apply via `kind === 'view_state_v2'`.
 */
export interface SavedViewState {
  kind: 'view_state_v2';
  filters: ViewFilter[];
  sort?: { field: string | null; direction: 'asc' | 'desc' } | null;
  columns?: string[] | null;
  scope?: 'all' | 'mine' | 'downline' | null;
  viewMode?: string | null;
  search?: string | null;
}

export type SavedViewCurrentState = Omit<SavedViewState, 'kind' | 'filters'>;

// ============================================================================
// Built-in quick views
// ============================================================================

export interface BuiltInSavedView {
  name: string;
  filters: ViewFilter[];
}

const makeFilters = (pairs: Record<string, string>): ViewFilter[] =>
  Object.entries(pairs).map(([field, value]) => ({ field, operator: 'equals', value }));

/**
 * Member-classification quick views. They filter on `record_type`,
 * `market_type`, `normalization_status` and `tobacco_user` — fields that
 * exist on the people modules (contacts / leads), so they are only offered
 * when EVERY field a view filters on exists on the current module. Showing
 * them elsewhere just yields an empty list.
 */
export const BUILT_IN_SAVED_VIEWS: readonly BuiltInSavedView[] = [
  { name: 'All Members', filters: makeFilters({ record_type: 'individual' }) },
  { name: 'HealthShare Members', filters: makeFilters({ record_type: 'individual', market_type: 'healthshare' }) },
  { name: 'Insurance Members', filters: makeFilters({ record_type: 'individual', market_type: 'traditional_insurance' }) },
  { name: 'Needs Review', filters: makeFilters({ normalization_status: 'needs_review' }) },
  { name: 'Needs Classification', filters: makeFilters({ market_type: 'unknown' }) },
  { name: 'Tobacco Users', filters: makeFilters({ record_type: 'individual', tobacco_user: 'true' }) },
  { name: 'Group Records', filters: makeFilters({ record_type: 'group' }) },
];

/**
 * Built-ins whose filter fields all exist on the module. Pass `undefined`
 * fields to get the legacy "always show" behaviour.
 */
export function getBuiltInSavedViews(fields?: ReadonlyArray<{ key: string }>): BuiltInSavedView[] {
  if (!fields) return [...BUILT_IN_SAVED_VIEWS];
  const known = new Set(fields.map((f) => f.key));
  return BUILT_IN_SAVED_VIEWS.filter((v) => v.filters.every((f) => known.has(f.field)));
}

// ============================================================================
// Apply resolution
// ============================================================================

export type SavedViewApplication =
  | { kind: 'state'; state: SavedViewState }
  | { kind: 'filters'; filters: ViewFilter[] };

/** Decode a stored `filters` JSONB (v2 blob, filter array or legacy key→value). */
export function resolveSavedViewApplication(view: Pick<SavedView, 'filters'>): SavedViewApplication {
  if (
    !Array.isArray(view.filters) &&
    view.filters &&
    (view.filters as Record<string, unknown>).kind === 'view_state_v2'
  ) {
    return { kind: 'state', state: view.filters as unknown as SavedViewState };
  }
  const filters = Array.isArray(view.filters)
    ? (view.filters as unknown as ViewFilter[])
    : Object.entries(view.filters ?? {}).map(([field, value]) => ({
        field,
        operator: 'equals' as const,
        value: value as string,
      }));
  return { kind: 'filters', filters };
}

/** Number of filters a saved view applies (v2 blob or legacy shape). */
export function savedViewFilterCount(view: Pick<SavedView, 'filters'> | null | undefined): number {
  if (!view) return 0;
  const app = resolveSavedViewApplication(view);
  return app.kind === 'state' ? (app.state.filters ?? []).length : app.filters.length;
}

// ============================================================================
// Data hook
// ============================================================================

export interface UseSavedViewsResult {
  views: SavedView[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Delete with undo toast; resolves false on failure. */
  remove: (id: string, name: string) => Promise<boolean>;
}

export function useSavedViews(pageKey: string, options: { enabled?: boolean } = {}): UseSavedViewsResult {
  const enabled = options.enabled !== false;
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/crm/saved-views?page_key=${encodeURIComponent(pageKey)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = (await res.json()) as { data?: SavedView[] };
      setViews(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load views');
    } finally {
      setLoading(false);
    }
  }, [pageKey, enabled]);

  useEffect(() => {
    if (enabled) setLoading(true);
    void refresh();
  }, [refresh, enabled]);

  const remove = useCallback(
    async (id: string, name: string) => {
      try {
        const res = await fetch(`/api/crm/saved-views?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('Failed to delete');
        setViews((prev) => prev.filter((v) => v.id !== id));
        toastItemDeletedWithUndo({ entity: 'saved_view', id, label: name ? `View "${name}"` : 'View', onUndo: refresh });
        return true;
      } catch {
        toast.error('Failed to delete view');
        return false;
      }
    },
    [refresh],
  );

  return { views, loading, error, refresh, remove };
}

// ============================================================================
// Save dialog
// ============================================================================

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: string;
  currentFilters: ViewFilter[];
  /** Additional UI state, enables the "save full layout" option. */
  currentViewState?: SavedViewCurrentState;
  /** Called with the created row after a successful save. */
  onSaved?: (view: SavedView) => void;
}

export function SaveViewDialog({
  open,
  onOpenChange,
  pageKey,
  currentFilters,
  currentViewState,
  onSaved,
}: SaveViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        {/* Radix unmounts the content on close, so the form's local state
            (name / toggle / saving) resets naturally between opens. */}
        <SaveViewForm
          pageKey={pageKey}
          currentFilters={currentFilters}
          currentViewState={currentViewState}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function SaveViewForm({
  pageKey,
  currentFilters,
  currentViewState,
  onClose,
  onSaved,
}: Omit<SaveViewDialogProps, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const [newViewName, setNewViewName] = useState('');
  // When true the save persists the full view state (filters + sort +
  // columns + scope + viewMode + search). Only available when the caller
  // passes `currentViewState`. Defaults on when there are no filters —
  // otherwise there would be nothing to save.
  const [saveFullState, setSaveFullState] = useState(
    () => Boolean(currentViewState) && currentFilters.length === 0,
  );
  const [saving, setSaving] = useState(false);

  const nothingToSave = currentFilters.length === 0 && !(saveFullState && currentViewState);

  const handleSave = async () => {
    if (!newViewName.trim() || saving || nothingToSave) return;
    setSaving(true);
    try {
      // Full-state saves store a self-describing `view_state_v2` object in
      // the `filters` JSONB; legacy saves store the raw filter array.
      const payloadFilters: unknown =
        saveFullState && currentViewState
          ? ({
              kind: 'view_state_v2',
              filters: currentFilters,
              sort: currentViewState.sort ?? null,
              columns: currentViewState.columns ?? null,
              scope: currentViewState.scope ?? null,
              viewMode: currentViewState.viewMode ?? null,
              search: currentViewState.search ?? null,
            } satisfies SavedViewState)
          : currentFilters;

      const res = await fetch('/api/crm/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: newViewName.trim(), filters: payloadFilters, page_key: pageKey }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const body = (await res.json().catch(() => ({}))) as { data?: SavedView };
      toast.success(`View "${newViewName.trim()}" saved`);
      onClose();
      onSaved?.(
        body.data ?? {
          id: '',
          name: newViewName.trim(),
          filters: payloadFilters as SavedView['filters'],
          page_key: pageKey,
          is_default: false,
          created_at: new Date().toISOString(),
        },
      );
    } catch {
      toast.error('Failed to save view');
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-slate-900 dark:text-white">Save current view</DialogTitle>
        <DialogDescription className="text-slate-500 dark:text-slate-400">
          Saved views are personal — only you see them.
        </DialogDescription>
      </DialogHeader>
      <div className="py-2 space-y-3">
        <Input
          aria-label="View name"
          placeholder="View name (e.g. My HealthShare Members)"
          value={newViewName}
          onChange={(e) => setNewViewName(e.target.value)}
          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        {currentViewState && (
          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveFullState}
              onChange={(e) => setSaveFullState(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>
              Save the full layout — filters, sort, columns, scope, view mode, and search — so
              applying this view restores everything at once.
            </span>
          </label>
        )}
        <p className="text-xs text-slate-500" aria-live="polite">
          {nothingToSave
            ? 'Add a filter or tick "Save the full layout" — there is nothing to save yet.'
            : saveFullState
              ? 'Applying this view will rehydrate the entire list UI.'
              : `This will save your current ${currentFilters.length} filter${currentFilters.length === 1 ? '' : 's'} so you can quickly return to this view later.`}
        </p>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !newViewName.trim() || nothingToSave}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden />
              Saving...
            </>
          ) : (
            'Save View'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// ============================================================================
// Legacy bookmark bar (composed from the primitives above)
// ============================================================================

interface SavedViewsBarProps {
  pageKey: string;
  currentFilters: ViewFilter[];
  onApplyView: (filters: ViewFilter[]) => void;
  /** Additional UI state, only used when saving/applying a full view. */
  currentViewState?: SavedViewCurrentState;
  /** Called when a `view_state_v2` saved view is applied. */
  onApplyViewState?: (state: SavedViewState) => void;
  /** Module fields — when given, built-in quick views only show if their fields exist. */
  fields?: ReadonlyArray<{ key: string }>;
}

export function SavedViewsBar({
  pageKey,
  currentFilters,
  onApplyView,
  currentViewState,
  onApplyViewState,
  fields,
}: SavedViewsBarProps) {
  const { views, loading, refresh, remove } = useSavedViews(pageKey);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const builtInViews = useMemo(() => getBuiltInSavedViews(fields), [fields]);

  const handleApply = (view: SavedView) => {
    setActiveViewId(view.id);
    const app = resolveSavedViewApplication(view);
    if (app.kind === 'state') {
      if (onApplyViewState) onApplyViewState(app.state);
      else onApplyView(app.state.filters ?? []);
      return;
    }
    onApplyView(app.filters);
  };

  const hasActiveFilters = currentFilters.length > 0;

  if (loading) return null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
            >
              <Bookmark className="w-3.5 h-3.5" aria-hidden />
              {activeViewId ? views.find((v) => v.id === activeViewId)?.name || 'Saved Views' : 'Views'}
              <ChevronDown className="w-3 h-3 opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
          >
            {builtInViews.map((view) => (
              <DropdownMenuItem
                key={view.name}
                onClick={() => {
                  setActiveViewId(null);
                  onApplyView(view.filters);
                }}
                className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-xs"
              >
                {view.name}
              </DropdownMenuItem>
            ))}

            {views.length > 0 && (
              <>
                {builtInViews.length > 0 && <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />}
                <div className="px-2 py-1">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">My Saved Views</p>
                </div>
                {views.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => handleApply(view)}
                    className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-xs flex items-center justify-between group"
                  >
                    <span className="flex items-center gap-1.5">
                      {view.is_default && <Star className="w-3 h-3 text-amber-500 fill-amber-500" aria-hidden />}
                      {view.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete view ${view.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(view.id, view.name).then((ok) => {
                          if (ok && activeViewId === view.id) setActiveViewId(null);
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden />
                    </button>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {views.length === 0 && builtInViews.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-slate-500">No saved views yet</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10"
            onClick={() => setShowSaveDialog(true)}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            Save View
          </Button>
        )}

        {activeViewId && (
          <button
            type="button"
            onClick={() => {
              setActiveViewId(null);
              onApplyView([]);
            }}
            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Clear view
          </button>
        )}
      </div>

      <SaveViewDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        pageKey={pageKey}
        currentFilters={currentFilters}
        currentViewState={currentViewState}
        onSaved={() => void refresh()}
      />
    </>
  );
}
