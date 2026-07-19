'use client';

/**
 * DuplicatesClient — /crm/duplicates
 *
 * Lightweight queue for working through probable-duplicate pairs the
 * bulk auto-merge left alone (because both sides had real history).
 *
 * Design notes:
 *
 *   - Each pair is a card with the two sides shown side-by-side. The
 *     operator chooses which side is the keeper (defaults to the one
 *     with more history), then clicks Merge. The dialog lets them
 *     override status if needed, everything else follows the
 *     keeper-wins-with-blank-fallback rule.
 *   - "Not a duplicate" writes to crm_duplicate_dismissals so the
 *     pair stops reappearing tomorrow. Dismissals are reversible — see
 *     the RPC for the undo path.
 *   - We never open two records in separate tabs to compare — the card
 *     already shows everything that matters (email, phone, status,
 *     history counts, match signals). "Open" links are available if
 *     someone wants to double-check notes/tasks directly.
 *
 * Client-side state machine: pairs are identified by `${left_id}:${right_id}`.
 * When a merge succeeds or a dismiss lands, we optimistically strip the
 * pair from the list and decrement the total — the next fetch will
 * reconcile if anything is off.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  GitMerge,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { MergeRecordDialog } from '@/components/crm/records/MergeRecordDialog';

export interface CrmModuleSummary {
  id: string;
  key: string;
  name: string;
}

interface PairRow {
  left_id: string;
  right_id: string;
  org_id: string;
  module_id: string;
  left_title: string | null;
  right_title: string | null;
  left_email: string | null;
  right_email: string | null;
  left_phone: string | null;
  right_phone: string | null;
  left_status: string | null;
  right_status: string | null;
  left_notes: number;
  right_notes: number;
  left_tasks: number;
  right_tasks: number;
  left_attachments: number;
  right_attachments: number;
  left_updated_at: string | null;
  right_updated_at: string | null;
  match_signals: string[];
  confidence: 'high' | 'medium' | 'low';
}

type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';
type SideKey = 'left' | 'right';

interface MergeTarget {
  keeper: {
    id: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
  };
  duplicate: {
    id: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
  };
  moduleKey: string;
  moduleName: string;
}

interface DismissTarget {
  left_id: string;
  right_id: string;
  left_title: string | null;
  right_title: string | null;
}

interface DuplicatesClientProps {
  modules: CrmModuleSummary[];
  canBulkMerge: boolean;
}

export function DuplicatesClient({ modules, canBulkMerge }: DuplicatesClientProps) {
  const [pairs, setPairs] = useState<PairRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confidence, setConfidence] = useState<ConfidenceFilter>('all');
  const [moduleId, setModuleId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Keeper choice per pair (defaults computed from history counts on load).
  const [keeperChoice, setKeeperChoice] = useState<Record<string, SideKey>>({});
  const [mergeTarget, setMergeTarget] = useState<MergeTarget | null>(null);
  const [dismissTarget, setDismissTarget] = useState<DismissTarget | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [isDismissing, setIsDismissing] = useState(false);
  const [isBulkMerging, setIsBulkMerging] = useState(false);

  const pageSize = 20;
  const moduleById = useMemo(() => {
    const map = new Map<string, CrmModuleSummary>();
    for (const m of modules) map.set(m.id, m);
    return map;
  }, [modules]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset pagination whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [confidence, moduleId, debouncedSearch]);

  const loadPairs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        confidence,
        page: String(page),
        page_size: String(pageSize),
      });
      if (moduleId !== 'all') params.set('module_id', moduleId);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/crm/duplicates?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const rows = (data.pairs || []) as PairRow[];
      setPairs(rows);
      setTotal(data.total ?? rows.length);

      // Seed keeper-side defaults: whichever side has more user history wins.
      const defaults: Record<string, SideKey> = {};
      for (const p of rows) {
        const lh = p.left_notes + p.left_tasks + p.left_attachments;
        const rh = p.right_notes + p.right_tasks + p.right_attachments;
        const key = pairKey(p);
        if (lh !== rh) {
          defaults[key] = lh >= rh ? 'left' : 'right';
        } else if (p.left_status === 'Active' && p.right_status !== 'Active') {
          defaults[key] = 'left';
        } else if (p.right_status === 'Active' && p.left_status !== 'Active') {
          defaults[key] = 'right';
        } else {
          const lu = p.left_updated_at ? Date.parse(p.left_updated_at) : 0;
          const ru = p.right_updated_at ? Date.parse(p.right_updated_at) : 0;
          defaults[key] = lu >= ru ? 'left' : 'right';
        }
      }
      setKeeperChoice((prev) => ({ ...defaults, ...prev }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load duplicate pairs';
      setError(msg);
      setPairs([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [confidence, moduleId, debouncedSearch, page]);

  useEffect(() => {
    loadPairs();
  }, [loadPairs]);

  const handleOpenMerge = useCallback(
    (pair: PairRow) => {
      const moduleSummary = moduleById.get(pair.module_id);
      const keeperSide = keeperChoice[pairKey(pair)] ?? 'left';
      const leftSide = {
        id: pair.left_id,
        title: pair.left_title,
        email: pair.left_email,
        phone: pair.left_phone,
        status: pair.left_status,
      };
      const rightSide = {
        id: pair.right_id,
        title: pair.right_title,
        email: pair.right_email,
        phone: pair.right_phone,
        status: pair.right_status,
      };
      setMergeTarget({
        keeper: keeperSide === 'left' ? leftSide : rightSide,
        duplicate: keeperSide === 'left' ? rightSide : leftSide,
        moduleKey: moduleSummary?.key || 'contacts',
        moduleName: moduleSummary?.name || 'record',
      });
    },
    [keeperChoice, moduleById],
  );

  const handleMergeComplete = useCallback(
    (payload: { keeperId: string; duplicateId: string }) => {
      // Optimistically drop the pair once the dialog reports success.
      setPairs((prev) =>
        prev.filter(
          (p) =>
            !(
              (p.left_id === payload.keeperId && p.right_id === payload.duplicateId) ||
              (p.right_id === payload.keeperId && p.left_id === payload.duplicateId)
            ),
        ),
      );
      setTotal((t) => Math.max(0, t - 1));
      setMergeTarget(null);
    },
    [],
  );

  const handleDismiss = useCallback(async () => {
    if (!dismissTarget) return;
    setIsDismissing(true);
    try {
      const res = await fetch('/api/crm/duplicates/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          left_id: dismissTarget.left_id,
          right_id: dismissTarget.right_id,
          reason: dismissReason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setPairs((prev) =>
        prev.filter(
          (p) =>
            !(p.left_id === dismissTarget.left_id && p.right_id === dismissTarget.right_id),
        ),
      );
      setTotal((t) => Math.max(0, t - 1));
      toast.success('Marked as not a duplicate');
      setDismissTarget(null);
      setDismissReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss pair');
    } finally {
      setIsDismissing(false);
    }
  }, [dismissTarget, dismissReason]);

  const handleBulkMerge = useCallback(async () => {
    if (!canBulkMerge) return;
    setIsBulkMerging(true);
    try {
      const res = await fetch('/api/crm/duplicates/bulk-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_per_rule: 1000 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Bulk merge failed (${res.status})`);
      }
      const merged = data.total ?? 0;
      const errs = data.errors ?? 0;
      toast.success(
        merged > 0
          ? `Auto-merged ${merged} pair${merged === 1 ? '' : 's'}${errs ? ` (${errs} skipped)` : ''}`
          : 'No auto-mergeable pairs found',
      );
      await loadPairs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run bulk merge');
    } finally {
      setIsBulkMerging(false);
    }
  }, [canBulkMerge, loadPairs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-sm">
            <GitMerge className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Review Duplicates
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Pairs the bulk auto-merge left alone because both sides have real history.
              Pick the keeper and merge, or mark the pair as not a duplicate so it stops
              showing up.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadPairs}
            disabled={isLoading}
            className="h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canBulkMerge && (
            <Button
              type="button"
              size="sm"
              onClick={handleBulkMerge}
              disabled={isBulkMerging}
              className="h-9"
            >
              {isBulkMerging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Auto-merging…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Auto-merge safe pairs
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-white/10">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="dup-search" className="text-xs text-slate-500">
            Search by name
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              id="dup-search"
              placeholder="Name on either side…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
        <div className="min-w-[160px]">
          <Label className="text-xs text-slate-500">Confidence</Label>
          <Select value={confidence} onValueChange={(v) => setConfidence(v as ConfidenceFilter)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All confidences</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label className="text-xs text-slate-500">Module</Label>
          <Select value={moduleId} onValueChange={setModuleId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-slate-500 ml-auto pb-1">
          <SlidersHorizontal className="w-3 h-3 inline mr-1" />
          {total} pair{total === 1 ? '' : 's'}
        </div>
      </div>

      {/* List */}
      {error && (
        <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {isLoading && pairs.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : pairs.length === 0 ? (
        <EmptyState hasFilters={confidence !== 'all' || moduleId !== 'all' || !!debouncedSearch} />
      ) : (
        <ul className="space-y-3">
          {pairs.map((pair) => (
            <PairCard
              key={pairKey(pair)}
              pair={pair}
              moduleName={moduleById.get(pair.module_id)?.name || 'Record'}
              keeperSide={keeperChoice[pairKey(pair)] ?? 'left'}
              onKeeperChange={(side) =>
                setKeeperChoice((prev) => ({ ...prev, [pairKey(pair)]: side }))
              }
              onMerge={() => handleOpenMerge(pair)}
              onDismiss={() =>
                setDismissTarget({
                  left_id: pair.left_id,
                  right_id: pair.right_id,
                  left_title: pair.left_title,
                  right_title: pair.right_title,
                })
              }
            />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Merge dialog */}
      {mergeTarget && (
        <MergeRecordDialog
          open={true}
          onOpenChange={(o) => !o && setMergeTarget(null)}
          moduleKey={mergeTarget.moduleKey}
          moduleName={mergeTarget.moduleName}
          keeper={{
            id: mergeTarget.keeper.id,
            title: mergeTarget.keeper.title,
            email: mergeTarget.keeper.email,
            phone: mergeTarget.keeper.phone,
            status: mergeTarget.keeper.status,
          }}
          initialCandidate={{
            id: mergeTarget.duplicate.id,
            title: mergeTarget.duplicate.title,
            email: mergeTarget.duplicate.email,
            phone: mergeTarget.duplicate.phone,
            status: mergeTarget.duplicate.status,
          }}
          onMerged={handleMergeComplete}
        />
      )}

      {/* Dismiss dialog */}
      <Dialog
        open={!!dismissTarget}
        onOpenChange={(o) => {
          if (!o && !isDismissing) {
            setDismissTarget(null);
            setDismissReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Not a duplicate
            </DialogTitle>
            <DialogDescription>
              Mark{' '}
              <strong>{dismissTarget?.left_title || '(untitled)'}</strong> and{' '}
              <strong>{dismissTarget?.right_title || '(untitled)'}</strong> as two
              different people. This pair will stop appearing in the review queue.
              You can undo it later from the audit log if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dup-reason" className="text-xs text-slate-500">
              Reason (optional)
            </Label>
            <Input
              id="dup-reason"
              placeholder="e.g. twins, same family address"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              maxLength={200}
              disabled={isDismissing}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDismissTarget(null);
                setDismissReason('');
              }}
              disabled={isDismissing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDismiss}
              disabled={isDismissing}
              className="bg-amber-500 hover:bg-amber-400 text-white"
            >
              {isDismissing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Not a duplicate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pair card
// ----------------------------------------------------------------------------

interface PairCardProps {
  pair: PairRow;
  moduleName: string;
  keeperSide: SideKey;
  onKeeperChange: (side: SideKey) => void;
  onMerge: () => void;
  onDismiss: () => void;
}

function PairCard({
  pair,
  moduleName,
  keeperSide,
  onKeeperChange,
  onMerge,
  onDismiss,
}: PairCardProps) {
  const confidenceStyle =
    pair.confidence === 'high'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
      : pair.confidence === 'medium'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';

  return (
    <li className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/60">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`px-2 py-0.5 rounded-full border font-medium uppercase tracking-wide ${confidenceStyle}`}
          >
            {pair.confidence}
          </span>
          <span className="text-slate-500">
            {moduleName} · matches on {formatSignals(pair.match_signals)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Users className="w-3 h-3" />
          Same name
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-white/5">
        <SidePanel
          pair={pair}
          side="left"
          selected={keeperSide === 'left'}
          onSelect={() => onKeeperChange('left')}
        />
        <SidePanel
          pair={pair}
          side="right"
          selected={keeperSide === 'right'}
          onSelect={() => onKeeperChange('right')}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-slate-900/40">
        <div className="text-xs text-slate-500">
          Keeper: <strong className="text-slate-700 dark:text-slate-200">
            {keeperSide === 'left' ? pair.left_title : pair.right_title}
          </strong>{' '}
          — other side will be deleted after all its notes/tasks move over.
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            <X className="w-3.5 h-3.5 mr-1" />
            Not a duplicate
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onMerge}
          >
            <GitMerge className="w-3.5 h-3.5 mr-1" />
            Merge
          </Button>
        </div>
      </div>
    </li>
  );
}

// ----------------------------------------------------------------------------
// Side panel
// ----------------------------------------------------------------------------

interface SidePanelProps {
  pair: PairRow;
  side: SideKey;
  selected: boolean;
  onSelect: () => void;
}

function SidePanel({ pair, side, selected, onSelect }: SidePanelProps) {
  const view = side === 'left'
    ? {
        id: pair.left_id,
        title: pair.left_title,
        email: pair.left_email,
        phone: pair.left_phone,
        status: pair.left_status,
        notes: pair.left_notes,
        tasks: pair.left_tasks,
        attachments: pair.left_attachments,
        updated: pair.left_updated_at,
      }
    : {
        id: pair.right_id,
        title: pair.right_title,
        email: pair.right_email,
        phone: pair.right_phone,
        status: pair.right_status,
        notes: pair.right_notes,
        tasks: pair.right_tasks,
        attachments: pair.right_attachments,
        updated: pair.right_updated_at,
      };
  const { id, title, email, phone, status, notes, tasks, attachments, updated } = view;
  const history = notes + tasks + attachments;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left p-4 transition-colors w-full ${
        selected
          ? 'bg-teal-50/60 dark:bg-teal-500/5 ring-1 ring-inset ring-teal-500/20'
          : 'hover:bg-slate-50 dark:hover:bg-white/5'
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="mt-0.5 flex-shrink-0">
          {selected ? (
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          ) : (
            <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-white/20" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 dark:text-white truncate">
              {title || '(untitled)'}
            </span>
            {status && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {status}
              </span>
            )}
            {selected && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400">
                keeper
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 space-y-0.5">
            <div className="truncate">{email || '— no email —'}</div>
            <div className="truncate">{phone || '— no phone —'}</div>
          </div>
        </div>
        <Link
          href={`/crm/r/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Open record in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span>
          <strong className="text-slate-700 dark:text-slate-300">{history}</strong> history
        </span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span>{notes}n · {tasks}t · {attachments}a</span>
        {updated && (
          <>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span>edited {formatRelative(updated)}</span>
          </>
        )}
      </div>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Empty state
// ----------------------------------------------------------------------------

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-16 px-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-slate-900/20">
      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
        {hasFilters ? 'No pairs match these filters' : "You're all caught up"}
      </h3>
      <p className="text-sm text-slate-500 mt-1">
        {hasFilters
          ? 'Try clearing the filters or switching confidence.'
          : 'Every probable-duplicate pair has been merged, dismissed, or there never were any. Nice work.'}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function pairKey(pair: { left_id: string; right_id: string }) {
  return `${pair.left_id}:${pair.right_id}`;
}

function formatSignals(signals: string[]) {
  if (!signals || signals.length === 0) return 'name';
  const map: Record<string, string> = {
    email: 'email',
    phone: 'phone',
    dob: 'date of birth',
  };
  const labels = signals.map((s) => map[s] || s);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function formatRelative(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const d = Math.floor(diff / 86_400_000);
  if (d < 1) {
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return 'just now';
    return `${h}h ago`;
  }
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
