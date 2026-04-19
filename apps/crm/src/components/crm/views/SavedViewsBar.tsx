'use client';

import { useState, useEffect, useCallback } from 'react';
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
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown> | unknown[];
  page_key: string;
  is_default: boolean;
  created_at: string;
}

interface ViewFilter {
  field: string;
  operator: string;
  value: string | number | boolean | string[] | null;
}

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

interface SavedViewsBarProps {
  pageKey: string;
  currentFilters: ViewFilter[];
  onApplyView: (filters: ViewFilter[]) => void;
  /** Additional UI state, only used when saving/applying a full view. */
  currentViewState?: Omit<SavedViewState, 'kind' | 'filters'>;
  /** Called when a `view_state_v2` saved view is applied. */
  onApplyViewState?: (state: SavedViewState) => void;
}

export function SavedViewsBar({
  pageKey,
  currentFilters,
  onApplyView,
  currentViewState,
  onApplyViewState,
}: SavedViewsBarProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  // When true the save dialog persists the full view state (filters + sort
  // + columns + scope + viewMode + search). Only available when the
  // caller passes `currentViewState`.
  const [saveFullState, setSaveFullState] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchViews = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/crm/saved-views?page_key=${encodeURIComponent(pageKey)}`,
      );
      const { data } = await res.json();
      setViews(data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [pageKey]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const handleSave = async () => {
    if (!newViewName.trim()) return;
    setSaving(true);
    try {
      // Shape the payload based on the toggle. Full-state saves store a
      // self-describing `view_state_v2` object in the `filters` JSONB,
      // while legacy saves continue to store the raw filter array.
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
        body: JSON.stringify({
          name: newViewName.trim(),
          filters: payloadFilters,
          page_key: pageKey,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(`View "${newViewName.trim()}" saved`);
      setNewViewName('');
      setShowSaveDialog(false);
      setSaveFullState(false);
      fetchViews();
    } catch {
      toast.error('Failed to save view');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(
        `/api/crm/saved-views?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(`View "${name}" deleted`);
      if (activeViewId === id) setActiveViewId(null);
      fetchViews();
    } catch {
      toast.error('Failed to delete view');
    }
  };

  const handleApply = (view: SavedView) => {
    setActiveViewId(view.id);
    // Full view-state blob (v2): hand it to the caller whole so it can
    // rehydrate sort / columns / scope / viewMode / search alongside
    // filters.
    if (
      !Array.isArray(view.filters) &&
      view.filters &&
      (view.filters as Record<string, unknown>).kind === 'view_state_v2'
    ) {
      const state = view.filters as unknown as SavedViewState;
      if (onApplyViewState) {
        onApplyViewState(state);
      } else {
        onApplyView(state.filters ?? []);
      }
      return;
    }
    // Legacy: either a filter array or a plain key→value record.
    const viewFilters = Array.isArray(view.filters)
      ? (view.filters as unknown as ViewFilter[])
      : Object.entries(view.filters).map(([field, value]) => ({
          field,
          operator: 'equals' as const,
          value: value as string,
        }));
    onApplyView(viewFilters);
  };

  const hasActiveFilters = currentFilters.length > 0;

  // Helper to build ViewFilter arrays from simple key-value pairs
  const makeFilters = (pairs: Record<string, string>): ViewFilter[] =>
    Object.entries(pairs).map(([field, value]) => ({
      field,
      operator: 'equals',
      value,
    }));

  // Built-in quick views
  const builtInViews = [
    {
      name: 'All Members',
      filters: makeFilters({ record_type: 'individual' }),
    },
    {
      name: 'HealthShare Members',
      filters: makeFilters({ record_type: 'individual', market_type: 'healthshare' }),
    },
    {
      name: 'Insurance Members',
      filters: makeFilters({ record_type: 'individual', market_type: 'traditional_insurance' }),
    },
    {
      name: 'Needs Review',
      filters: makeFilters({ normalization_status: 'needs_review' }),
    },
    {
      name: 'Needs Classification',
      filters: makeFilters({ market_type: 'unknown' }),
    },
    {
      name: 'Tobacco Users',
      filters: makeFilters({ record_type: 'individual', tobacco_user: 'true' }),
    },
    {
      name: 'Group Records',
      filters: makeFilters({ record_type: 'group' }),
    },
  ];

  if (loading) return null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Saved Views Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
            >
              <Bookmark className="w-3.5 h-3.5" />
              {activeViewId
                ? views.find((v) => v.id === activeViewId)?.name || 'Saved Views'
                : 'Views'}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
          >
            {/* Built-in views */}
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
                <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                <div className="px-2 py-1">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    My Saved Views
                  </p>
                </div>
                {views.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => handleApply(view)}
                    className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-xs flex items-center justify-between group"
                  >
                    <span className="flex items-center gap-1.5">
                      {view.is_default && (
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      )}
                      {view.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(view.id, view.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Save Current View Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10"
            onClick={() => setShowSaveDialog(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Save View
          </Button>
        )}

        {/* Active View Indicator */}
        {activeViewId && (
          <button
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

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              Save Current View
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Input
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
                  Save the full layout — filters, sort, columns, scope, view
                  mode, and search — so applying this view restores everything
                  at once.
                </span>
              </label>
            )}
            <p className="text-xs text-slate-500">
              {saveFullState
                ? 'Applying this view will rehydrate the entire list UI.'
                : 'This will save your current filters so you can quickly return to this view later.'}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveDialog(false)}
              className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !newViewName.trim()}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save View'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
