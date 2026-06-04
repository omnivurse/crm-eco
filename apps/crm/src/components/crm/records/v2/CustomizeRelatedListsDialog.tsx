'use client';

/**
 * CustomizeRelatedListsDialog — lets the user pin/unpin and reorder the
 * related-list nav rail per module. Persists to
 * `profiles.ui_preferences.related_list_order[moduleKey]`.
 *
 * Behaviour:
 *   - Shows two stacks: "Pinned" (visible in the rail, in order) and
 *     "Available" (hidden). Move arrows reorder within Pinned; Add/Remove
 *     swaps between stacks.
 *   - "Reset to default" clears the override for this module.
 *   - Persists via `useUiPreferences().patch({ related_list_order })` —
 *     which is already merge-safe on the server (unknown keys preserved).
 *   - "Coming soon" items can't be pinned (they're disabled in the
 *     Available column). This keeps Zoho-parity parity honest.
 */

import { useMemo, useState, useCallback } from 'react';
import { ArrowUp, ArrowDown, Plus, Minus, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { useUiPreferences } from '@/hooks/useUiPreferences';

export interface CustomizeRelatedListsItem {
  id: string;
  label: string;
  /** Available in the current module context (e.g. Notes are always on). */
  available: boolean;
  /** Optional hint shown when unavailable. */
  comingSoonHint?: string;
}

export interface CustomizeRelatedListsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleKey: string;
  /** Full catalog of panels this module could render, in default order. */
  catalog: CustomizeRelatedListsItem[];
  /**
   * IDs that should never be hidden (e.g. "details" for the Details pane).
   * They stay pinned and are not reorderable past the top.
   */
  lockedIds?: string[];
}

export function CustomizeRelatedListsDialog({
  open,
  onOpenChange,
  moduleKey,
  catalog,
  lockedIds = [],
}: CustomizeRelatedListsDialogProps) {
  const { preferences, patch } = useUiPreferences();

  const defaultOrder = useMemo(() => catalog.map((c) => c.id), [catalog]);
  const stored = preferences.related_list_order?.[moduleKey];

  // Working copy — mutable while the dialog is open so the user can preview
  // changes before committing.
  const [draft, setDraft] = useState<string[]>(stored ?? defaultOrder);

  // Re-sync the working copy to the latest saved order each time the dialog
  // opens. Uses React's "adjust state during render" pattern instead of an
  // effect: it avoids the cascading post-commit re-render (and the
  // set-state-in-effect lint), and it no longer clobbers an in-progress edit
  // if `stored` changes while the dialog is already open.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(stored ?? defaultOrder);
  }

  const byId = useMemo(() => {
    const m = new Map<string, CustomizeRelatedListsItem>();
    for (const c of catalog) m.set(c.id, c);
    return m;
  }, [catalog]);

  const pinned = draft.filter((id) => byId.has(id));
  const available = catalog.filter((c) => !draft.includes(c.id));

  const move = (id: string, dir: -1 | 1) => {
    setDraft((curr) => {
      const idx = curr.indexOf(id);
      if (idx === -1) return curr;
      const next = [...curr];
      // Respect locked items at the top.
      const lowerBound = lockedIds.length;
      const target = idx + dir;
      if (target < lowerBound || target >= next.length) return next;
      if (lockedIds.includes(next[target])) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const unpin = (id: string) => {
    if (lockedIds.includes(id)) return;
    setDraft((curr) => curr.filter((x) => x !== id));
  };

  const pin = (id: string) => {
    setDraft((curr) => (curr.includes(id) ? curr : [...curr, id]));
  };

  const reset = () => {
    setDraft(defaultOrder);
  };

  const save = useCallback(async () => {
    const next = {
      ...(preferences.related_list_order ?? {}),
      [moduleKey]: draft,
    };
    await patch({ related_list_order: next });
    onOpenChange(false);
  }, [draft, moduleKey, patch, preferences.related_list_order, onOpenChange]);

  const isDirty = useMemo(() => {
    const a = stored ?? defaultOrder;
    if (a.length !== draft.length) return true;
    for (let i = 0; i < a.length; i++) if (a[i] !== draft[i]) return true;
    return false;
  }, [draft, stored, defaultOrder]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle>Customize related lists</DialogTitle>
          <DialogDescription>
            Pin the panels you use most and drag the arrows to reorder them in the
            record sidebar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {/* Pinned --------------------------------------------------------- */}
          <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/40 overflow-hidden">
            <header className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Pinned ({pinned.length})
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal-600 transition-colors normal-case"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </header>
            <ul className="max-h-72 overflow-y-auto">
              {pinned.length === 0 ? (
                <li className="px-3 py-4 text-xs text-slate-500 text-center">
                  Nothing pinned yet — add from the right.
                </li>
              ) : (
                pinned.map((id, idx) => {
                  const item = byId.get(id);
                  if (!item) return null;
                  const locked = lockedIds.includes(id);
                  return (
                    <li
                      key={id}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 dark:border-white/5 last:border-b-0',
                        locked && 'bg-slate-100/60 dark:bg-white/5',
                      )}
                    >
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => move(id, -1)}
                          disabled={locked || idx <= lockedIds.length}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(id, 1)}
                          disabled={locked || idx >= pinned.length - 1}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">
                        {item.label}
                      </span>
                      {!item.available && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          Soon
                        </span>
                      )}
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => unpin(id)}
                          className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 transition-colors"
                          aria-label={`Unpin ${item.label}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          {/* Available ------------------------------------------------------ */}
          <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 overflow-hidden">
            <header className="flex items-center px-3 py-2 border-b border-slate-200 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Available ({available.length})
            </header>
            <ul className="max-h-72 overflow-y-auto">
              {available.length === 0 ? (
                <li className="px-3 py-4 text-xs text-slate-500 text-center">
                  Every panel is pinned.
                </li>
              ) : (
                available.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 dark:border-white/5 last:border-b-0"
                  >
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">
                      {item.label}
                    </span>
                    {!item.available && item.comingSoonHint && (
                      <span
                        title={item.comingSoonHint}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                      >
                        Soon
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => pin(item.id)}
                      className="p-1 rounded hover:bg-teal-50 dark:hover:bg-teal-500/10 text-slate-400 hover:text-teal-600 transition-colors"
                      aria-label={`Pin ${item.label}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={!isDirty}
            className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40"
          >
            Save layout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
