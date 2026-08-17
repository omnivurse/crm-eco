'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  ChevronDown,
  Star,
  Lock,
  Globe,
  Plus,
  Check,
  Pencil,
  Bookmark,
  Save,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { CrmView } from '@/lib/crm/types';
import {
  SaveViewDialog,
  getBuiltInSavedViews,
  resolveSavedViewApplication,
  useSavedViews,
  type SavedView,
  type SavedViewCurrentState,
  type SavedViewFilter,
  type SavedViewState,
} from '@/components/crm/views/SavedViewsBar';

/**
 * ViewsDropdown — THE single "Views" control for a module list.
 *
 *   Shared views  → org `crm_views` (is_shared / default) — navigate via `?view=`
 *   My views      → the user's own `crm_views` + personal `saved_views`
 *   Quick views   → built-in filter presets (only where their fields exist)
 *   Save current view… / Create new view
 *
 * Personal `saved_views` are applied through the same callbacks the old
 * SavedViewsBar used (`onApplyView` / `onApplyViewState`), so ModuleShell
 * keeps one write path to the URL.
 */
interface ViewsDropdownProps {
  views: CrmView[];
  activeViewId?: string;
  moduleKey: string;
  onCreateView?: () => void;
  onEditView?: (viewId: string) => void;
  className?: string;
  /** Module fields — gates the built-in quick views. */
  fields?: ReadonlyArray<{ key: string }>;
  /** Current URL filters — what "Save current view…" stores. */
  currentFilters?: SavedViewFilter[];
  /** Additional list UI state so a saved view can restore the full layout. */
  currentViewState?: SavedViewCurrentState;
  /** Apply a personal / built-in filter-only view. */
  onApplyView?: (filters: SavedViewFilter[]) => void;
  /** Apply a personal `view_state_v2` view (falls back to `onApplyView`). */
  onApplyViewState?: (state: SavedViewState) => void;
  /**
   * Which personal saved view is currently applied (controlled). When the
   * caller clears filters it should reset this so the trigger label follows.
   */
  activeSavedViewId?: string | null;
  onActiveSavedViewChange?: (id: string | null) => void;
}

const itemClass = (active: boolean) =>
  cn(
    'flex items-center justify-between gap-2 py-2 cursor-pointer group',
    'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5',
    active && 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300',
  );

export function ViewsDropdown({
  views,
  activeViewId,
  moduleKey,
  onCreateView,
  onEditView,
  className,
  fields,
  currentFilters = [],
  currentViewState,
  onApplyView,
  onApplyViewState,
  activeSavedViewId: activeSavedViewIdProp,
  onActiveSavedViewChange,
}: ViewsDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [uncontrolledSavedId, setUncontrolledSavedId] = useState<string | null>(null);
  const activeSavedViewId = activeSavedViewIdProp !== undefined ? activeSavedViewIdProp : uncontrolledSavedId;
  const setActiveSavedViewId = (id: string | null) => {
    setUncontrolledSavedId(id);
    onActiveSavedViewChange?.(id);
  };

  const personalEnabled = Boolean(onApplyView);
  const saved = useSavedViews(moduleKey, { enabled: personalEnabled });
  const savedViews = personalEnabled ? saved.views : [];
  const builtInViews = useMemo(() => (personalEnabled ? getBuiltInSavedViews(fields) : []), [fields, personalEnabled]);

  const activeView = views.find((v) => v.id === activeViewId) || views.find((v) => v.is_default);
  const activeSaved = activeSavedViewId ? savedViews.find((v) => v.id === activeSavedViewId) ?? null : null;

  const handleViewChange = (viewId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', viewId);
    // A crm_view carries its own sort; a stale URL sort would override it on
    // the server (URL > view). Drop it, plus the page, so the newly chosen
    // view applies exactly as saved. ModuleShell resyncs its sort state from
    // the URL when `?view=` changes.
    params.delete('sortField');
    params.delete('sortDirection');
    params.delete('page');
    setActiveSavedViewId(null);
    router.push(`/crm/modules/${moduleKey}?${params.toString()}`);
    setOpen(false);
  };

  /** Delete a personal saved view (undo toast comes from `saved.remove`). */
  const deleteSaved = (view: SavedView) => {
    void saved.remove(view.id, view.name).then((ok) => {
      if (ok && activeSavedViewId === view.id) {
        setActiveSavedViewId(null);
        onApplyView?.([]);
      }
    });
  };

  const applySaved = (view: SavedView) => {
    setActiveSavedViewId(view.id);
    const app = resolveSavedViewApplication(view);
    if (app.kind === 'state') {
      if (onApplyViewState) onApplyViewState(app.state);
      else onApplyView?.(app.state.filters ?? []);
    } else {
      onApplyView?.(app.filters);
    }
    setOpen(false);
  };

  // Group org views: default first, then shared, then personal, A→Z within.
  const sortedViews = useMemo(
    () =>
      [...views].sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        if (a.is_shared && !b.is_shared) return -1;
        if (!a.is_shared && b.is_shared) return 1;
        return a.name.localeCompare(b.name);
      }),
    [views],
  );
  const sharedOrgViews = sortedViews.filter((v) => v.is_shared || v.is_default);
  const myOrgViews = sortedViews.filter((v) => !v.is_shared && !v.is_default);
  const hasMyViews = myOrgViews.length > 0 || savedViews.length > 0;
  const canSave = personalEnabled && (currentFilters.length > 0 || Boolean(currentViewState));

  const triggerLabel = activeSaved?.name || activeView?.name || 'All Records';

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            aria-label={`Views: ${triggerLabel}`}
            className={cn(
              'h-9 px-3 gap-2 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50',
              'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              'hover:bg-slate-50 dark:hover:bg-white/5',
              className,
            )}
          >
            {activeSaved ? (
              <Bookmark className="w-3.5 h-3.5 text-teal-500" aria-hidden />
            ) : (
              <>
                {activeView?.is_default && <Star className="w-3.5 h-3.5 text-amber-500" aria-hidden />}
                {activeView?.is_shared ? (
                  <Globe className="w-3.5 h-3.5 text-slate-400" aria-hidden />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400" aria-hidden />
                )}
              </>
            )}
            <span className="max-w-[150px] truncate">{triggerLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-72 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
        >
          {/* ---- Shared views (org crm_views) ---- */}
          <DropdownMenuLabel className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Shared views
          </DropdownMenuLabel>
          {sharedOrgViews.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No shared views</div>
          ) : (
            sharedOrgViews.map((view) => (
              <OrgViewItem
                key={view.id}
                view={view}
                active={!activeSaved && activeView?.id === view.id}
                onSelect={() => handleViewChange(view.id)}
                onEdit={onEditView && !view.is_default ? () => onEditView(view.id) : undefined}
              />
            ))
          )}

          {/* ---- My views (own crm_views + personal saved_views) ---- */}
          {personalEnabled && (
            <>
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
              <DropdownMenuLabel className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                My views
              </DropdownMenuLabel>
              {myOrgViews.map((view) => (
                <OrgViewItem
                  key={view.id}
                  view={view}
                  active={!activeSaved && activeView?.id === view.id}
                  onSelect={() => handleViewChange(view.id)}
                  onEdit={onEditView ? () => onEditView(view.id) : undefined}
                />
              ))}
              {saved.loading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500" role="status">
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                  Loading your views…
                </div>
              ) : saved.error ? (
                <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400" role="alert">
                  Couldn&apos;t load your views.{' '}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={(e) => {
                      e.preventDefault();
                      void saved.refresh();
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                savedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => applySaved(view)}
                    // Keyboard: the nested trash button is not reachable inside a
                    // Radix menu (Tab is trapped), so Delete/Backspace on the
                    // focused item deletes — same undo toast as the mouse path.
                    onKeyDown={(e) => {
                      if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteSaved(view);
                      }
                    }}
                    aria-keyshortcuts="Delete"
                    className={itemClass(activeSavedViewId === view.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {view.is_default ? (
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" aria-hidden />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden />
                      )}
                      <span className="truncate">{view.name}</span>
                      <span className="sr-only">, press Delete to remove this view</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {activeSavedViewId === view.id && (
                        <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden />
                      )}
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        title={`Delete view ${view.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          deleteSaved(view);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden />
                      </button>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              {!saved.loading && !saved.error && !hasMyViews && (
                <div className="px-3 py-2 text-xs text-slate-500">
                  Nothing saved yet — set up filters, then “Save current view…”.
                </div>
              )}

              {/* ---- Quick views (built-ins gated by module fields) ---- */}
              {builtInViews.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                  <DropdownMenuLabel className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Quick views
                  </DropdownMenuLabel>
                  {builtInViews.map((view) => (
                    <DropdownMenuItem
                      key={view.name}
                      onClick={() => {
                        setActiveSavedViewId(null);
                        onApplyView?.(view.filters);
                        setOpen(false);
                      }}
                      className={itemClass(false)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden />
                        <span className="truncate">{view.name}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </>
          )}

          <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />

          {personalEnabled && (
            <DropdownMenuItem
              disabled={!canSave}
              onClick={() => {
                setShowSaveDialog(true);
                setOpen(false);
              }}
              className="flex items-center gap-2 py-2 cursor-pointer text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 data-[disabled]:opacity-50"
            >
              <Save className="w-3.5 h-3.5" aria-hidden />
              Save current view…
            </DropdownMenuItem>
          )}

          {activeSaved && (
            <DropdownMenuItem
              onClick={() => {
                setActiveSavedViewId(null);
                onApplyView?.([]);
                setOpen(false);
              }}
              className="flex items-center gap-2 py-2 cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Trash2 className="w-3.5 h-3.5 opacity-0" aria-hidden />
              Leave “{activeSaved.name}”
            </DropdownMenuItem>
          )}

          {onCreateView && (
            <DropdownMenuItem
              onClick={() => {
                onCreateView();
                setOpen(false);
              }}
              className="flex items-center gap-2 py-2 cursor-pointer text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />
              Create new view
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {personalEnabled && (
        <SaveViewDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          pageKey={moduleKey}
          currentFilters={currentFilters}
          currentViewState={currentViewState}
          onSaved={(view) => {
            void saved.refresh();
            if (view.id) setActiveSavedViewId(view.id);
          }}
        />
      )}
    </>
  );
}

function OrgViewItem({
  view,
  active,
  onSelect,
  onEdit,
}: {
  view: CrmView;
  active: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onSelect}
      // Keyboard: the nested pencil button is not reachable inside a Radix
      // menu (Tab is trapped), so F2 on the focused item opens the editor.
      // (A letter key would collide with the menu's typeahead.)
      onKeyDown={
        onEdit
          ? (e) => {
              if (e.key === 'F2') {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }
            }
          : undefined
      }
      aria-keyshortcuts={onEdit ? 'F2' : undefined}
      className={itemClass(active)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {view.is_default ? (
          <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" aria-hidden />
        ) : view.is_shared ? (
          <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden />
        ) : (
          <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden />
        )}
        <span className="truncate">{view.name}</span>
        {onEdit && <span className="sr-only">, press F2 to edit this view</span>}
      </div>
      <div className="flex items-center gap-1">
        {active && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden />}
        {onEdit && (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            title={`Edit view ${view.name}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onEdit();
            }}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          >
            <Pencil className="w-3 h-3" aria-hidden />
          </button>
        )}
      </div>
    </DropdownMenuItem>
  );
}
