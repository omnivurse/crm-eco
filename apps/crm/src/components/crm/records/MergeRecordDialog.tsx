'use client';

/**
 * MergeRecordDialog — collapses a duplicate record into this one.
 *
 * UX contract (see the back-and-forth on the PIFH duplicates issue):
 *
 *   - Simple by default: suggest candidates from /api/crm/records/check-duplicate
 *     using this record's email/phone. User picks one, clicks "Merge into
 *     this record", done.
 *   - An "Advanced" toggle exposes a status/email/phone/owner override so
 *     the operator can resolve conflicts manually before committing.
 *   - Active status wins automatically. This is the product decision from
 *     the merge-tool design question; the advanced picker can still
 *     override it.
 *
 * Why side-by-side instead of a full field picker?
 * A full per-field picker is overkill for the 80% case ("dupe has an empty
 * address, keeper has the good one — just merge"). The RPC already does
 * a keeper-wins-with-blank-fallback merge, which is the right behavior
 * almost always. The status override covers the one field where the
 * automatic rule is actually debatable.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  AlertTriangle,
  GitMerge,
  Loader2,
  Search,
  Settings2,
  Users,
  CheckCircle2,
} from 'lucide-react';

interface CandidateRecord {
  id: string;
  title: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
}

interface RecordSnapshot {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  owner_id?: string | null;
  created_at?: string | null;
}

interface MergeRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleKey: string;
  moduleName: string;
  keeper: RecordSnapshot;
  /**
   * Pre-selected candidate — used by the Review Duplicates page so the
   * operator doesn't have to re-search for a pair we already know about.
   * When present the dialog skips the auto-suggest fetch; the user can
   * still switch to a different candidate via search if they want to.
   */
  initialCandidate?: CandidateRecord | null;
  /** Called after a successful merge, in addition to the default refresh. */
  onMerged?: (payload: { keeperId: string; duplicateId: string }) => void;
}

export function MergeRecordDialog({
  open,
  onOpenChange,
  moduleKey,
  moduleName,
  keeper,
  initialCandidate = null,
  onMerged,
}: MergeRecordDialogProps) {
  const router = useRouter();
  const [suggested, setSuggested] = useState<CandidateRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CandidateRecord[]>([]);
  const [selected, setSelected] = useState<CandidateRecord | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [statusOverride, setStatusOverride] = useState<string>('auto');
  const [isMerging, setIsMerging] = useState(false);

  // Reset state every time the dialog is opened — avoids carrying stale
  // selections across two different "merge" clicks on the same page.
  // When invoked from the duplicate-review page with a pre-selected
  // candidate, seed both `suggested` and `selected` so it renders
  // immediately, without waiting for a network round-trip.
  useEffect(() => {
    if (!open) return;
    if (initialCandidate) {
      setSelected(initialCandidate);
      setSuggested([initialCandidate]);
    } else {
      setSelected(null);
      setSuggested([]);
    }
    setSearchQuery('');
    setSearchResults([]);
    setAdvanced(false);
    setStatusOverride('auto');
  }, [open, initialCandidate]);

  // Auto-suggest candidates: anything with matching email/phone is almost
  // certainly a duplicate (that's exactly what check-duplicate is for).
  // Skip this when a caller hands us a pre-selected duplicate — we
  // already know which record is being merged.
  useEffect(() => {
    if (!open) return;
    if (initialCandidate) return;
    if (!keeper.email && !keeper.phone) return;

    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ module_key: moduleKey, exclude_id: keeper.id });
      if (keeper.email) params.set('email', keeper.email);
      if (keeper.phone) params.set('phone', keeper.phone);

      try {
        const res = await fetch(`/api/crm/records/check-duplicate?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSuggested(data.duplicates || []);
      } catch {
        // Silent — fall back to manual search.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, moduleKey, keeper.id, keeper.email, keeper.phone, initialCandidate]);

  // Debounced title/email search when there are no auto-matches (or the
  // user wants to pick a different record than we suggested).
  useEffect(() => {
    if (!open) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          module_key: moduleKey,
          search: q,
          page_size: '10',
        });
        const res = await fetch(`/api/crm/records?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const rows = (data.records || []) as CandidateRecord[];
          setSearchResults(rows.filter((r) => r.id !== keeper.id));
        }
      } catch {
        // noop
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, searchQuery, moduleKey, keeper.id]);

  const candidates = useMemo(() => {
    // Suggested first (highest confidence), then search hits not already shown.
    const seen = new Set(suggested.map((c) => c.id));
    const extras = searchResults.filter((r) => !seen.has(r.id));
    return [...suggested, ...extras];
  }, [suggested, searchResults]);

  const handleMerge = useCallback(async () => {
    if (!selected) return;
    setIsMerging(true);
    try {
      const body: Record<string, unknown> = { duplicate_id: selected.id };
      if (advanced && statusOverride !== 'auto') {
        body.merged_status = statusOverride;
      }

      const res = await fetch(`/api/crm/records/${keeper.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || 'Merge failed');
      }

      const notesMoved = data.moved_notes ?? 0;
      const tasksMoved = data.moved_tasks ?? 0;
      toast.success(
        `Merged successfully${
          notesMoved || tasksMoved
            ? ` — moved ${notesMoved} note${notesMoved === 1 ? '' : 's'}` +
              (tasksMoved ? ` and ${tasksMoved} task${tasksMoved === 1 ? '' : 's'}` : '')
            : ''
        }`,
      );
      onOpenChange(false);
      onMerged?.({ keeperId: keeper.id, duplicateId: selected.id });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to merge records');
    } finally {
      setIsMerging(false);
    }
  }, [selected, advanced, statusOverride, keeper.id, onOpenChange, onMerged, router]);

  return (
    <Dialog open={open} onOpenChange={(v) => !isMerging && onOpenChange(v)}>
      <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <GitMerge className="w-5 h-5 text-teal-500" />
            Merge duplicate {moduleName.toLowerCase()}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            All notes, tasks, attachments, and related records from the duplicate will
            move onto <span className="font-medium text-slate-700 dark:text-slate-300">{keeper.title || 'this record'}</span>,
            and the duplicate will be deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="space-y-2">
          <Label htmlFor="merge-search" className="text-xs text-slate-500">
            Search for the duplicate record
          </Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              id="merge-search"
              placeholder="Search by name, email, or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoComplete="off"
            />
            {searching && (
              <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Candidate list */}
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/30">
          {candidates.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {searchQuery
                ? 'No matching records yet. Try a different search.'
                : 'No likely duplicates found. Use the search above to pick one manually.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-white/5">
              {suggested.length > 0 && (
                <li className="px-3 py-1.5 bg-teal-50/50 dark:bg-teal-500/5 text-[11px] font-medium uppercase tracking-wide text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  Likely duplicates ({suggested.length})
                </li>
              )}
              {candidates.map((c) => {
                const isSuggested = suggested.some((s) => s.id === c.id);
                const isSelected = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className={`w-full text-left px-3 py-2.5 transition-colors flex items-start gap-2 ${
                        isSelected
                          ? 'bg-teal-500/10 hover:bg-teal-500/15'
                          : 'hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-teal-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-white/20" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {c.title || '(untitled)'}
                          </span>
                          {c.status && (
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                c.status === 'Active'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {c.status}
                            </span>
                          )}
                          {isSuggested && !isSelected && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              likely duplicate
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {c.email || '—'}
                          {c.phone ? ` · ${c.phone}` : ''}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Advanced options */}
        {selected && (
          <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Merging{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {selected.title || '(untitled)'}
                </span>{' '}
                into{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {keeper.title || '(this record)'}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAdvanced((v) => !v)}
                className="h-7 text-xs text-slate-500"
              >
                <Settings2 className="w-3.5 h-3.5 mr-1" />
                {advanced ? 'Hide' : 'Advanced'}
              </Button>
            </div>

            {!advanced ? (
              <p className="text-xs text-slate-500 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                Keeper values win. Any fields the keeper has blank will be filled in from the
                duplicate. <strong>Active status wins</strong> when the two records disagree.
              </p>
            ) : (
              <div className="space-y-2 pt-1">
                <div>
                  <Label className="text-xs text-slate-500">Status for merged record</Label>
                  <Select value={statusOverride} onValueChange={setStatusOverride}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        Auto (Active wins, else keeper)
                      </SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      {keeper.status && !['Active', 'Pending', 'Inactive'].includes(keeper.status) && (
                        <SelectItem value={keeper.status}>
                          Keep &quot;{keeper.status}&quot;
                        </SelectItem>
                      )}
                      {selected.status &&
                        !['Active', 'Pending', 'Inactive'].includes(selected.status) &&
                        selected.status !== keeper.status && (
                          <SelectItem value={selected.status}>
                            Use duplicate&apos;s &quot;{selected.status}&quot;
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-slate-400">
                  Other fields (address, phone, dates, etc.) follow the keeper-wins-with-blank-fallback rule.
                  Open each record individually to compare before merging if you need more control.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleMerge}
            disabled={!selected || isMerging}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Merging…
              </>
            ) : (
              <>
                <GitMerge className="w-4 h-4 mr-2" />
                Merge into this record
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
