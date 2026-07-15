'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RotateCcw,
  Trash2,
  Loader2,
  Inbox,
  FileText,
  CheckSquare,
  StickyNote,
  Paperclip,
  Link2,
  Users,
  Building2,
  Bookmark,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@crm-eco/ui/components/alert-dialog';

const RETENTION_DAYS = 30;

interface TrashItem {
  entity: string;
  id: string;
  label: string;
  sublabel: string | null;
  deleted_at: string | null;
  deleted_origin: string | null;
  purgeable: boolean;
}

interface TrashGroup {
  entity: string;
  title: string;
  items: TrashItem[];
  count: number;
}

const ENTITY_ICON: Record<string, typeof FileText> = {
  record: FileText,
  task: CheckSquare,
  note: StickyNote,
  attachment: Paperclip,
  record_link: Link2,
  contact_group: Users,
  carrier_contact: Building2,
  sticky_note: StickyNote,
  saved_view: Bookmark,
};

function purgeDate(deletedAt: string | null): string {
  if (!deletedAt) return '—';
  const d = new Date(deletedAt);
  d.setDate(d.getDate() + RETENTION_DAYS);
  return d.toLocaleDateString();
}

/** key that uniquely identifies a row for busy-state + optimistic removal. */
function rowKey(item: Pick<TrashItem, 'entity' | 'id'>): string {
  return `${item.entity}:${item.id}`;
}

export function TrashClient() {
  const [groups, setGroups] = useState<TrashGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/trash', { credentials: 'same-origin' });
      if (!res.ok) {
        toast.error('Failed to load Trash');
        setGroups([]);
        return;
      }
      const body = (await res.json()) as { groups?: TrashGroup[] };
      setGroups(body.groups ?? []);
    } catch {
      toast.error('Failed to load Trash');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Drop a row from local state after a successful restore/purge. */
  const removeItem = useCallback((item: TrashItem) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.entity === item.entity
          ? { ...g, items: g.items.filter((i) => i.id !== item.id), count: g.count - 1 }
          : g,
      ),
    );
  }, []);

  const restore = useCallback(
    async (item: TrashItem) => {
      setBusyKey(rowKey(item));
      try {
        const res =
          item.entity === 'record'
            ? await fetch(`/api/crm/records/${item.id}/restore`, {
                method: 'POST',
                credentials: 'same-origin',
              })
            : await fetch('/api/crm/trash/restore-item', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entity: item.entity, id: item.id }),
              });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          toast.error(body?.error || 'Could not restore item');
          return;
        }
        removeItem(item);
        toast.success('Restored');
      } finally {
        setBusyKey(null);
      }
    },
    [removeItem],
  );

  const purge = useCallback(
    async (item: TrashItem) => {
      setBusyKey(rowKey(item));
      try {
        const res = await fetch(`/api/crm/records/${item.id}/purge`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          toast.error('Could not permanently delete');
          return;
        }
        removeItem(item);
        toast.success('Permanently deleted');
      } finally {
        setBusyKey(null);
      }
    },
    [removeItem],
  );

  const nonEmpty = useMemo(() => groups.filter((g) => g.items.length > 0), [groups]);
  const total = useMemo(() => nonEmpty.reduce((sum, g) => sum + g.items.length, 0), [nonEmpty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Trash…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Inbox className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium text-slate-500 dark:text-slate-300">Trash is empty</p>
        <p className="text-sm">
          Deleted items appear here for {RETENTION_DAYS} days before they’re permanently removed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {nonEmpty.map((group) => {
        const Icon = ENTITY_ICON[group.entity] ?? FileText;
        return (
          <section
            key={group.entity}
            className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
              <Icon className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {group.title}
              </h2>
              <span className="text-xs text-slate-400">
                {group.items.length}
                {group.items.length === 200 ? '+' : ''}
              </span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {group.items.map((item) => {
                const busy = busyKey === rowKey(item);
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 dark:hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {item.label}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {item.sublabel ? `${item.sublabel} · ` : ''}
                        {item.deleted_origin ? `${item.deleted_origin} · ` : ''}
                        deleted{' '}
                        <span suppressHydrationWarning>
                          {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : '—'}
                        </span>
                        {' · purge after '}
                        <span suppressHydrationWarning>{purgeDate(item.deleted_at)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void restore(item)}
                        title="Restore"
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                      {item.purgeable ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              title="Delete permanently"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &ldquo;{item.label}&rdquo; and all of
                                its notes, tasks, activities, and attachments. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void purge(item)}>
                                Delete permanently
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <div className="text-right">
        <Link
          href="/crm"
          className="text-sm text-teal-600 hover:underline dark:text-teal-400"
        >
          Back to CRM
        </Link>
      </div>
      <p className="text-center text-xs text-slate-400">
        {total} item{total === 1 ? '' : 's'} in Trash · kept {RETENTION_DAYS} days
      </p>
    </div>
  );
}
